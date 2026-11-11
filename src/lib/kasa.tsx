// Uygulama durumu: eşleşmiş cihaz, 30 sn'de bir sunucu senkronu, okutma olayları.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { api, type ScanEvent } from './api';
import { clearDevice, loadDevice, saveDevice, type Device } from './storage';
import { PERIOD_SEC } from './qrToken';

const HEARTBEAT_MS = PERIOD_SEC * 1000;

type Status = { online: boolean | null; todayCount: number | null; clockOffsetMs: number };
type PairOutcome = { ok: true } | { ok: false; message: string };

type KasaContextValue = {
  ready: boolean;
  mock: boolean;
  device: Device | null;
  status: Status;
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
  const [status, setStatus] = useState<Status>({ online: null, todayCount: null, clockOffsetMs: 0 });
  const [recent, setRecent] = useState<ScanEvent[]>([]);
  const [revokeReason, setRevokeReason] = useState<string | null>(null);

  const scanListeners = useRef(new Set<(ev: ScanEvent) => void>());
  const seen = useRef(new Set<string>());
  const lastSync = useRef<number | null>(null);

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
    setStatus({ online: null, todayCount: null, clockOffsetMs: 0 });
    setRevokeReason(reason ?? null);
  }, []);

  const heartbeat = useCallback(
    async (d: Device) => {
      const sentAt = Date.now();
      try {
        const res = await api.heartbeat(d, lastSync.current);
        if (res.status === 'revoked') return unpair('Bu cihaz panelden iptal edildi.');
        // Ağ gecikmesinin yarısını düşerek saat farkını bul; QR penceresi sunucuyla hizalı kalsın
        const offset = res.serverTime - (sentAt + (Date.now() - sentAt) / 2);
        lastSync.current = Date.now();
        setStatus((s) => ({
          online: true,
          todayCount: res.todayCount ?? s.todayCount,
          clockOffsetMs: Number.isFinite(offset) ? offset : s.clockOffsetMs,
        }));
        const fresh = (res.events ?? []).filter((ev) => !seen.current.has(ev.id));
        if (fresh.length) {
          fresh.forEach((ev) => seen.current.add(ev.id));
          setRecent((r) => [...fresh.reverse(), ...r].slice(0, 3));
          fresh.forEach((ev) => scanListeners.current.forEach((cb) => cb(ev)));
        }
      } catch (e: any) {
        if (e?.status === 401 || e?.status === 403) return unpair('Cihaz yetkisi geçersiz. Yeniden eşleştirin.');
        setStatus((s) => ({ ...s, online: false }));
      }
    },
    [unpair]
  );

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
    <KasaContext.Provider value={{ ready, mock: api.mock, device, status, recent, revokeReason, pair, unpair, onScan }}>
      {children}
    </KasaContext.Provider>
  );
}

export function useKasa() {
  const ctx = useContext(KasaContext);
  if (!ctx) throw new Error('useKasa, KasaProvider içinde kullanılmalı');
  return ctx;
}
