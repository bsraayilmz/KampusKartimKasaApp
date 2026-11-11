import { expect, test } from '@jest/globals';
import { buildToken, verifyToken, PERIOD_SEC, toBase64Url, fromBase64Url } from './qrToken';

const secret = toBase64Url(new Uint8Array(32).fill(7));
const device = { deviceId: 'dv_test', secret };
const T = 1_800_000_000_000;

test('base64url gidiş-dönüş', () => {
  for (const len of [0, 1, 2, 3, 31, 32]) {
    const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 37) & 255);
    expect(Array.from(fromBase64Url(toBase64Url(bytes)))).toEqual(Array.from(bytes));
  }
});

test('token aynı 30 sn penceresinde sabit, sonrakinde değişir', () => {
  const a = buildToken(device, T);
  expect(buildToken(device, a.startsAt + 29_999).url).toBe(a.url);
  expect(buildToken(device, a.expiresAt).url).not.toBe(a.url);
  expect(a.expiresAt - a.startsAt).toBe(PERIOD_SEC * 1000);
});

test('geçerli ve bir önceki pencere kabul, daha eskisi ret', () => {
  const t = buildToken(device, T);
  expect(verifyToken(device, t.url, T)).toBe(true);
  expect(verifyToken(device, t.url, t.expiresAt + 1000)).toBe(true);
  expect(verifyToken(device, t.url, t.expiresAt + PERIOD_SEC * 1000 + 1)).toBe(false);
});

test('başka cihaz, başka sır, bozulmuş imza ve gelecek pencere reddedilir', () => {
  const t = buildToken(device, T);
  expect(verifyToken({ ...device, deviceId: 'dv_other' }, t.url, T)).toBe(false);
  expect(verifyToken({ ...device, secret: toBase64Url(new Uint8Array(32).fill(9)) }, t.url, T)).toBe(false);
  expect(verifyToken(device, t.url.slice(0, -1) + (t.url.endsWith('A') ? 'B' : 'A'), T)).toBe(false);
  expect(verifyToken(device, buildToken(device, T + PERIOD_SEC * 1000).url, T)).toBe(false);
});
