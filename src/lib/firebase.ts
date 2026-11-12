// Firebase bağlantısı. Yönetim paneli (kampuskartim.web.app) ve öğrenci uygulamasıyla aynı proje;
// yetkiler sunucuda Firestore kurallarıyla uygulanır (panel deposu: firebase/firestore.rules).
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, onAuthStateChanged, signInAnonymously, type Auth, type User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { authPersistence } from './persistence';

const config = {
  apiKey: 'AIzaSyBzZ0eHGOHsvd7AjMBm1hexynbH5X2488E',
  authDomain: 'pale-balls-meghassoft.firebaseapp.com',
  projectId: 'pale-balls-meghassoft',
  storageBucket: 'pale-balls-meghassoft.firebasestorage.app',
  messagingSenderId: '750610046248',
  appId: '1:750610046248:web:17d5f3c2447f6cd21a441d',
};

const firstLoad = getApps().length === 0;
export const app = firstLoad ? initializeApp(config) : getApp();
export const auth: Auth = firstLoad ? initializeAuth(app, { persistence: authPersistence() }) : getAuth(app);
export const db = getFirestore(app);

/** Kasa tableti kullanıcı girişi yapmaz: anonim oturum. Cihaz kaydı (`devices.authUid`) bu oturuma bağlanır. */
export function kasaUser(): Promise<User> {
  return new Promise((resolve, reject) => {
    const off = onAuthStateChanged(auth, (user) => {
      off();
      if (user) resolve(user);
      else signInAnonymously(auth).then((c) => resolve(c.user), reject);
    });
  });
}
