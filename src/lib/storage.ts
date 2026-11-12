// Eşleştirme bilgisi cihazın güvenli deposunda (iOS Keychain / Android Keystore) tutulur.
// Web hedefinde (yalnızca geliştirme/önizleme) SecureStore olmadığı için localStorage kullanılır.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type Business = { name: string; register: string; location: string };
export type Device = {
  /** Firestore `devices/{deviceId}`; anonim oturumla (`authUid`) eşleşir. */
  deviceId: string;
  businessId: string;
  business: Business;
  pairedAt: string;
};

const KEY = 'kk.device.v2';
const web = Platform.OS === 'web';

const backend = {
  get: (k: string) => (web ? Promise.resolve(globalThis.localStorage?.getItem(k) ?? null) : SecureStore.getItemAsync(k)),
  set: (k: string, v: string) => (web ? Promise.resolve(globalThis.localStorage?.setItem(k, v)) : SecureStore.setItemAsync(k, v)),
  del: (k: string) => (web ? Promise.resolve(globalThis.localStorage?.removeItem(k)) : SecureStore.deleteItemAsync(k)),
};

export async function loadDevice(): Promise<Device | null> {
  try {
    const raw = await backend.get(KEY);
    return raw ? (JSON.parse(raw) as Device) : null;
  } catch {
    return null; // bozuk kayıt → yeniden eşleştir
  }
}

export async function saveDevice(device: Device): Promise<void> {
  await backend.set(KEY, JSON.stringify(device));
}

export async function clearDevice(): Promise<void> {
  try {
    await backend.del(KEY);
  } catch {}
}
