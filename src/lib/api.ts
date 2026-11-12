// Kasa tabletinin backend'i: Firebase (yönetim paneli ve öğrenci uygulamasıyla aynı proje).
//   Eşleştirme   pairingCodes/{6 hane} oku → tek yazımda devices/{yeni} (status: online) + kodu kullanıldı işaretle
//   Kalp atışı   devices/{id}.lastSeenAt (panelde çevrimiçi/çevrimdışı) + sunucu saati + cihaz durumu
//   QR           30 sn'de bir qrTokens/{anahtar}; QR içeriği kampuskartim://checkout/{businessId}/{anahtar}
//   Okutmalar    redemptions where deviceId == bu cihaz (bugünküler, canlı)
// Kurallar: panel deposu firebase/firestore.rules (devices, pairingCodes, qrTokens, redemptions).

import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { FirebaseError } from 'firebase/app';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { db, kasaUser } from './firebase';
import { toBase64Url } from './qrToken';
import type { Business, Device } from './storage';

export type ScanEvent = { id: string; badge: string; campaign: string; student: string; at: number };
export type PairResult = { deviceId: string; businessId: string; business: Business };
/** disabled: panelden devre dışı bırakıldı (yeniden etkinleştirilebilir); revoked: kayıt silindi. */
export type HeartbeatResult = { serverTime: number; status: 'active' | 'disabled' | 'revoked' };
export type QrCode = { url: string; expiresAt: number };
export type TodayScans = { todayCount: number; events: ScanEvent[] };

export class ApiError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message);
  }
}

export interface KasaApi {
  readonly mock: boolean;
  pair(code: string): Promise<PairResult>;
  heartbeat(device: Device): Promise<HeartbeatResult>;
  /** Sunucu saatine göre `expiresAt`'te biten tek kullanımlık QR anahtarı (kural: en fazla 35 sn). */
  issueQr(device: Device, expiresAt: number): Promise<QrCode>;
  /** Bugün bu kasada okutulanlar, en yeni önce. Gece yarısı yeniden abone olunmalı. */
  watchScans(device: Device, onChange: (scans: TodayScans) => void, onError: (e: ApiError) => void): () => void;
}

const APP_VERSION = `${Platform.OS}-${Constants.expoConfig?.version ?? '0'}`.slice(0, 20);
const TIMEOUT_MS = 10_000;

// Firestore çevrimdışıyken yazımı kuyruğa alır ve beklemede bırakır; kasa ekranı bağlantı yok demeli.
function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new ApiError('Sunucuya ulaşılamadı', undefined, 'network')), TIMEOUT_MS);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(toApiError(e))),
    );
  });
}

function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof FirebaseError) {
    if (e.code === 'permission-denied') return new ApiError('Bu işlem için yetki yok.', 403, e.code);
    if (e.code === 'not-found') return new ApiError('Kayıt bulunamadı.', 404, e.code);
    if (e.code === 'unavailable' || e.code.startsWith('auth/network')) return new ApiError('Sunucuya ulaşılamadı', undefined, 'network');
  }
  return new ApiError('Beklenmeyen bir hata oluştu.');
}

const badgeOf = (r: DocumentData) =>
  r.discountType === 'amount' ? `${Number(r.discountValue).toLocaleString('tr-TR')} ₺` : `%${r.discountValue}`;

function firebaseApi(): KasaApi {
  return {
    mock: false,

    async pair(code) {
      await withTimeout(kasaUser());
      const codeRef = doc(db, 'pairingCodes', code);
      const snap = await withTimeout(getDocFromServer(codeRef)).catch((e: ApiError) => {
        throw e.status === 403 ? new ApiError('Kod bulunamadı.', 404, 'invalid') : e;
      });
      const pairing = snap.data();
      if (!pairing) throw new ApiError('Kod bulunamadı.', 404, 'invalid');
      if (pairing.usedBy != null) throw new ApiError('Bu kod kullanılmış. Panelden yeni kod al.', 410, 'used');
      if (pairing.expiresAt.toMillis() <= Date.now()) throw new ApiError('Kodun süresi dolmuş. Panelden yeni kod al.', 410, 'expired');

      const businessId: string = pairing.businessId;
      const business = (await withTimeout(getDoc(doc(db, 'businesses', businessId)))).data();
      if (!business || business.status !== 'active') throw new ApiError('İşletme yayında değil. Panelden kontrol et.', 409, 'business');
      const mall = business.mallId ? (await withTimeout(getDoc(doc(db, 'malls', business.mallId)))).data() : undefined;

      const user = await kasaUser();
      const deviceRef = doc(collection(db, 'devices'));
      const deviceName = (Constants.deviceName ?? `${Platform.OS} tablet`).slice(0, 48);
      const batch = writeBatch(db);
      batch.set(deviceRef, {
        businessId,
        mallId: pairing.mallId ?? null,
        name: pairing.name,
        serialNumber: `${deviceName} · ${deviceRef.id.slice(0, 6).toUpperCase()}`,
        appVersion: APP_VERSION,
        status: 'online',
        authUid: user.uid,
        pairingCode: code,
        createdAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      });
      batch.update(codeRef, { usedBy: user.uid, deviceId: deviceRef.id, usedAt: serverTimestamp() });
      await withTimeout(batch.commit()).catch((e: ApiError) => {
        // Kod bu arada başka tablette kullanıldıysa ya da süresi dolduysa kural reddeder.
        throw e.status === 403 ? new ApiError('Kod artık geçerli değil. Panelden yeni kod al.', 410, 'expired') : e;
      });

      return {
        deviceId: deviceRef.id,
        businessId,
        business: {
          name: business.name ?? '',
          register: pairing.name,
          location: [mall?.name, business.locationDetail].filter(Boolean).join(' · ') || (mall ? '' : 'Bağımsız işletme'),
        },
      };
    },

    async heartbeat(device) {
      await withTimeout(kasaUser());
      const ref = doc(db, 'devices', device.deviceId);
      try {
        await withTimeout(updateDoc(ref, { lastSeenAt: serverTimestamp(), appVersion: APP_VERSION }));
      } catch (e) {
        // Panelde silinen cihazın belgesi de okunamaz → kayıt kaldırılmış.
        if ((e as ApiError).status === 404) return { serverTime: Date.now(), status: 'revoked' };
        throw e;
      }
      const data = (await withTimeout(getDocFromServer(ref))).data();
      if (!data) return { serverTime: Date.now(), status: 'revoked' };
      return {
        serverTime: data.lastSeenAt?.toMillis?.() ?? Date.now(),
        status: data.status === 'online' ? 'active' : data.status === 'disabled' ? 'disabled' : 'revoked',
      };
    },

    async issueQr(device, expiresAt) {
      const token = toBase64Url(Crypto.getRandomBytes(18));
      await withTimeout(
        setDoc(doc(db, 'qrTokens', token), {
          deviceId: device.deviceId,
          businessId: device.businessId,
          createdAt: serverTimestamp(),
          expiresAt: Timestamp.fromMillis(expiresAt),
        }),
      );
      return { url: `kampuskartim://checkout/${device.businessId}/${token}`, expiresAt };
    },

    watchScans(device, onChange, onError) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const q = query(
        collection(db, 'redemptions'),
        where('deviceId', '==', device.deviceId),
        where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
        orderBy('createdAt', 'desc'),
      );
      return onSnapshot(
        q,
        (snap) =>
          onChange({
            todayCount: snap.size,
            events: snap.docs.map((d) => {
              const r = d.data();
              return {
                id: d.id,
                badge: badgeOf(r),
                campaign: r.campaignTitle ?? '',
                student: r.studentMasked ?? '',
                at: r.createdAt?.toMillis?.() ?? Date.now(),
              };
            }),
          }),
        (e) => onError(toApiError(e)),
      );
    },
  };
}

export const api: KasaApi = firebaseApi();
