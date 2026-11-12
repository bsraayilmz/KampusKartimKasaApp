// Uygulama durumu: eşleşmiş cihaz, 30 sn'de bir sunucu senkronu, QR anahtarı, canlı okutma olayları.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { api, type QrCode, type ScanEvent } from './api';
import { clearDevice, loadDevice, saveDevice, type Device } from './storage';
import { PERIOD_SEC } from './qrToken';

const HEARTBEAT_MS = PERIOD_SEC * 1000;
const QR_RETRY_MS = 3000;
// Silinen cihazın belgesi kurallarca okunamaz; yetki hatası da kaldırılmış kayıt demektir.
const REMOVED = 'Bu cihaz panelden kaldırıldı. Yeniden eşleştirin.';

/** disabled: panelden devre dışı; QR üretilemez, yeniden etkinleştirilince kendiliğinden döner. */
type Status = { online: boolean | null; disabled: boolean; todayCount: number | null; clockOffsetMs: number };
type PairOutcome = { ok: true } | { ok: false; message: string };

type KasaContextValue = {
  ready: boolean;
  mock: boolean;
  device: Device | null;
  status: Status;
  /** Ekrandaki QR; ilk senkron ve ilk anahtar yazılana kadar null. */
  qr: QrCode | null;
  recent: ScanEvent[];
  revokeReason: string | null;
  pair(code: string): Promise<PairOutcome>;
  unpair(reason?: string): Promise<void>;
  /** Yeni okutma olaylarına abone ol (onay bildirimi için). */
  onScan(cb: (ev: ScanEvent) => void): () => void;
};

const KasaContext = createContext<KasaContextValue | null>(null);

export function KasaProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);
  const [status, setStatus] = useState<Status>({ online: null, disabled: false, todayCount: null, clockOffsetMs: 0 });
  const [qr, setQr] = useState<QrCode | null>(null);
  const [synced, setSynced] = useState(false);
  const [recent, setRecent] = useState<ScanEvent[]>([]);
  const [revokeReason, setRevokeReason] = useState<string | null>(null);

  const scanListeners = useRef(new Set<(ev: ScanEvent) => void>());
  const seen = useRef(new Set<string>());
  const clockOffset = useRef(0);

  useEffect(() => {
    loadDevice().then((d) => {
      setDevice(d);
      setReady(true);
    });
  }, []);

  const unpair = useCallback(async (reason?: string) => {
    await clearDevice();
    setDevice(null);
    setRecent([]);
    setQr(null);
    setSynced(false);
    setStatus({ online: null, disabled: false, todayCount: null, clockOffsetMs: 0 });
    setRevokeReason(reason ?? null);
  }, []);

  const heartbeat = useCallback(
    async (d: Device) => {
      const sentAt = Date.now();
      try {
        const res = await api.heartbeat(d);
        if (res.status === 'revoked') return unpair(REMOVED);
        // Ağ gecikmesinin yarısını düşerek saat farkını bul; QR süresi sunucuyla hizalı kalsın
        const offset = res.serverTime - (sentAt + (Date.now() - sentAt) / 2);
        if (Number.isFinite(offset)) clockOffset.current = offset;
        setSynced(true);
        setStatus((s) => ({ ...s, online: true, disabled: res.status === 'disabled', clockOffsetMs: clockOffset.current }));
      } catch (e: any) {
        if (e?.status === 401 || e?.status === 403) return unpair(REMOVED);
        setStatus((s) => ({ ...s, online: false }));
      }
    },
    [unpair]
  );

  // Bu kasada bugün okutulanlar (canlı). İlk liste bildirim göstermez; sonradan gelenler yeşil onay ekranı açar.
  const [day, setDay] = useState(() => new Date().toDateString());
  useEffect(() => {
    if (!device) return;
    const midnight = new Date();
    midnight.setHours(24, 0, 5, 0);
    const rollover = setTimeout(() => setDay(new Date().toDateString()), midnight.getTime() - Date.now());
    let first = true;
    const off = api.watchScans(
      device,
      ({ todayCount, events }) => {
        const fresh = first ? [] : events.filter((ev) => !seen.current.has(ev.id));
        first = false;
        events.forEach((ev) => seen.current.add(ev.id));
        setRecent(events.slice(0, 3));
        setStatus((s) => ({ ...s, todayCount }));
        [...fresh].reverse().forEach((ev) => scanListeners.current.forEach((cb) => cb(ev)));
      },
      (e) => {
        if (e.status === 403) unpair(REMOVED);
      }
    );
    return () => {
      clearTimeout(rollover);
      off();
    };
  }, [device, day, unpair]);

  // QR: sunucu saatine göre 30 sn'lik pencerelerin her başında yeni tek kullanımlık anahtar
  useEffect(() => {
    if (!device || !synced || status.disabled) {
      setQr(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const issue = async () => {
      const now = Date.now() + clockOffset.current;
      const expiresAt = (Math.floor(now / HEARTBEAT_MS) + 1) * HEARTBEAT_MS;
      try {
        const code = await api.issueQr(device, expiresAt);
        if (cancelled) return;
        setQr(code);
        timer = setTimeout(issue, Math.max(0, expiresAt - (Date.now() + clockOffset.current)));
      } catch {
        if (cancelled) return;
        setStatus((s) => ({ ...s, online: false }));
        timer = setTimeout(issue, QR_RETRY_MS);
      }
    };
    issue();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [device, synced, status.disabled]);

  // 30 sn'lik senkron döngüsü + uygulama öne gelince hemen senkron
  useEffect(() => {
    if (!device) return;
    const first = setTimeout(() => heartbeat(device), 0);
    const t = setInterval(() => heartbeat(device), HEARTBEAT_MS);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && heartbeat(device));
    return () => {
      clearTimeout(first);
      clearInterval(t);
      sub.remove();
    };
  }, [device, heartbeat]);

  const pair = useCallback(async (code: string): Promise<PairOutcome> => {
    const clean = code.replace(/\D/g, '');
    if (clean.length !== 6) return { ok: false, message: 'Kod 6 haneli olmalı.' };
    try {
      const res = await api.pair(clean);
      const d: Device = { ...res, pairedAt: new Date().toISOString() };
      await saveDevice(d);
      seen.current.clear();
      setRevokeReason(null);
      setDevice(d);
      return { ok: true };
    } catch (e: any) {
      const message =
        e?.status === 404 || e?.code === 'invalid'
          ? 'Kod bulunamadı. Panelde gösterilen kodu kontrol et.'
          : e?.message || 'Eşleştirme başarısız.';
      return { ok: false, message };
    }
  }, []);

  const onScan = useCallback((cb: (ev: ScanEvent) => void) => {
    scanListeners.current.add(cb);
    return () => {
      scanListeners.current.delete(cb);
    };
  }, []);

  return (
    <KasaContext.Provider value={{ ready, mock: api.mock, device, status, qr, recent, revokeReason, pair, unpair, onScan }}>
      {children}
    </KasaContext.Provider>
  );
}

export function useKasa() {
  const ctx = useContext(KasaContext);
  if (!ctx) throw new Error('useKasa, KasaProvider içinde kullanılmalı');
  return ctx;
}
