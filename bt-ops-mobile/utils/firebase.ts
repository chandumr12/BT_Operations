import { Platform } from 'react-native';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, type Auth, type Persistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            'AIzaSyCFl3n1PmSTN6eO4NdNDevIvFAmO78fV_M',
  authDomain:        'bengaluru-trekkers-ops.firebaseapp.com',
  projectId:         'bengaluru-trekkers-ops',
  storageBucket:     'bengaluru-trekkers-ops.firebasestorage.app',
  messagingSenderId: '257754693783',
  appId:             '1:257754693783:web:56d100167617bc1ef769d2',
};

const isNew = getApps().length === 0;
const app = isNew ? initializeApp(firebaseConfig) : getApp();

/**
 * Keep users signed in across app restarts (until they explicitly sign out).
 *
 * On React Native, Firebase Auth defaults to in-memory persistence, so the
 * session is lost every time the app is closed — we have to pass AsyncStorage
 * explicitly. `getReactNativePersistence` only exists in firebase/auth's
 * React Native build, so it's required lazily and only on native; on web the
 * module doesn't export it at all (and browsers already persist via
 * IndexedDB/localStorage by default).
 */
function createAuth(): Auth {
  if (Platform.OS === 'web' || !isNew) return getAuth(app);
  const { getReactNativePersistence } = require('firebase/auth') as {
    getReactNativePersistence: (storage: unknown) => Persistence;
  };
  return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}

export const auth = createAuth();

// Packing Lists and Vehicle Allocation have no REST endpoints — the web app
// reads those Firestore collections directly, so the mobile app does the same.
export const firestore = getFirestore(app);
