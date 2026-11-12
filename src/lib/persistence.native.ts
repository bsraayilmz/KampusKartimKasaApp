import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Persistence } from 'firebase/auth';
// @ts-expect-error getReactNativePersistence yalnızca React Native paketinde tanımlı (firebase/auth "react-native" girişi).
import { getReactNativePersistence } from 'firebase/auth';

/** iOS / Android: anonim kasa oturumu AsyncStorage'da kalır; cihaz kaydı bu oturuma bağlıdır. */
export const authPersistence = (): Persistence => getReactNativePersistence(AsyncStorage);
