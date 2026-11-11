// Kasa tabletinin backend ile konuştuğu iki uç:
//   POST /kasa/pair       { code, deviceName }            → { deviceId, secret, deviceToken, business }
//   POST /kasa/heartbeat  (Bearer deviceToken) { since }  → { serverTime, status, todayCount, events[] }
// status: "active" | "revoked"
//
// EXPO_PUBLIC_KK_API_URL verilmezse uygulama DEMO modunda çalışır (sahte backend).

import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Business, Device } from './storage';
import { toBase64Url } from './qrToken';

export type ScanEvent = { id: string; badge: string; campaign: string; student: string; at: number };
export type PairResult = { deviceId: string; secret: string; deviceToken: string; business: Business };
export type HeartbeatResult = {
  serverTime: number;
  status: 'active' | 'revoked';
  todayCount?: number;
  events?: ScanEvent[];
};

export class ApiError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message);
  }
}

export interface KasaApi {
  readonly mock: boolean;
  pair(code: string): Promise<PairResult>;
  heartbeat(device: Device, since: number | null): Promise<HeartbeatResult>;
}

function realApi(baseUrl: string): KasaApi {
  async function call<T>(path: string, body: unknown, token?: string): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(new URL(path, baseUrl).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch {
      throw new ApiError('Sunucuya ulaşılamadı', undefined, 'network');
    } finally {
      clearTimeout(timer);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.message || `Sunucu hatası (${res.status})`, res.status, data.code);
    return data as T;
  }

  const deviceName = Constants.deviceName ?? `${Platform.OS} tablet`;
  return {
    mock: false,
    pair: (code) => call('/kasa/pair', { code, deviceName }),
    heartbeat: (device, since) => call('/kasa/heartbeat', { since }, device.deviceToken),
  };
}

// Backend olmadan uçtan uca deneme: her 6 haneli kod eşleşir, 000000 süresi dolmuş kod gibi davranır.
function mockApi(): KasaApi {
  const campaigns = [
    { badge: '%30', campaign: 'Tüm menülerde indirim' },
    { badge: 'Bedava', campaign: 'Menüye içecek bizden' },
    { badge: '%15', campaign: 'Öğle menüsü' },
  ];
  const students = ['Elif Y.', 'Mert K.', 'Zeynep A.', 'Can D.', 'Ece T.', 'Emre S.'];
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let todayCount = 7;

  return {
    mock: true,
    async pair(code) {
      await wait(600);
      if (code === '000000') throw new ApiError('Kodun süresi dolmuş. Panelden yeni kod al.', 410, 'expired');
      return {
        deviceId: 'dv_' + toBase64Url(Crypto.getRandomBytes(6)),
        secret: toBase64Url(Crypto.getRandomBytes(32)),
        deviceToken: toBase64Url(Crypto.getRandomBytes(24)),
        business: { name: 'Hunger', register: 'Kasa 1', location: 'Agora AVM · 1. kat' },
      };
    },
    async heartbeat() {
      await wait(150);
      const events: ScanEvent[] = [];
      if (Math.random() < 0.35) {
        todayCount += 1;
        events.push({ id: Crypto.randomUUID(), ...pick(campaigns), student: pick(students), at: Date.now() });
      }
      return { serverTime: Date.now(), status: 'active', todayCount, events };
    },
  };
}

const baseUrl = process.env.EXPO_PUBLIC_KK_API_URL;
export const api: KasaApi = baseUrl ? realApi(baseUrl) : mockApi();
