// Kasa QR kodu: her 30 saniyelik pencere için cihaz sırrıyla HMAC imzalanan token.
// Sunucu aynı sırrı bildiği için durumsuz doğrular; tablet internetsiz kalsa bile
// gösterdiği QR geçerli kalır (öğrencinin telefonu zaten online).

import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';

export const PERIOD_SEC = 30;
export const QR_BASE_URL = 'https://kampuskartim.com/k/';

export type DeviceKey = { deviceId: string; secret: string };
export type QrToken = { win: number; url: string; startsAt: number; expiresAt: number };

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = i + 2 < bytes.length ? 4 : i + 1 < bytes.length ? 3 : 2;
    for (let j = 0; j < chars; j++) out += B64URL[(n >> (18 - 6 * j)) & 63];
  }
  return out;
}

export function fromBase64Url(s: string): Uint8Array {
  const bytes: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of s) {
    const v = B64URL.indexOf(ch);
    if (v < 0) throw new Error('geçersiz base64url');
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buf >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

export const windowAt = (ms: number) => Math.floor(ms / 1000 / PERIOD_SEC);

function sign(secret: string, deviceId: string, win: number): string {
  const mac = hmac(sha256, fromBase64Url(secret), new TextEncoder().encode(`${deviceId}:${win}`));
  return toBase64Url(mac).slice(0, 22); // 132 bit — QR'ı sade tutar, tahmin edilemez
}

export function buildToken(device: DeviceKey, ms: number): QrToken {
  const win = windowAt(ms);
  const startsAt = win * PERIOD_SEC * 1000;
  return {
    win,
    url: `${QR_BASE_URL}${device.deviceId}.${win}.${sign(device.secret, device.deviceId, win)}`,
    startsAt,
    expiresAt: startsAt + PERIOD_SEC * 1000,
  };
}

// Sunucu tarafı için referans doğrulama (backend aynı mantığı uygulamalı).
// Saat kayması için bir önceki pencereyi de kabul eder.
export function verifyToken(device: DeviceKey, url: string, nowMs: number, graceWindows = 1): boolean {
  if (!url.startsWith(QR_BASE_URL)) return false;
  const [deviceId, winStr, sig] = url.slice(QR_BASE_URL.length).split('.');
  if (deviceId !== device.deviceId || !sig) return false;
  const win = Number(winStr);
  const now = windowAt(nowMs);
  if (!Number.isInteger(win) || win > now || now - win > graceWindows) return false;
  const expected = sign(device.secret, deviceId, win);
  let diff = expected.length ^ sig.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (sig.charCodeAt(i) || 0);
  return diff === 0;
}
