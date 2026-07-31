// Second Firebase app — points at the EXISTING bt-finance Firestore.
// Mirrors frontend/src/lib/financeFirebase.js exactly.
// ⚠️  DO NOT change projectId — this is what preserves the live finance data.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const financeConfig = {
  apiKey:            'AIzaSyBzbycQjAkARU5Ft4ae-7lYuau1BuLDdyo',
  authDomain:        'bt-finance-41556.firebaseapp.com',
  projectId:         'bt-finance-41556',
  storageBucket:     'bt-finance-41556.firebasestorage.app',
  messagingSenderId: '209437203357',
  appId:             '1:209437203357:web:e4f1b889c4bff7e6afad74',
};

const financeApp = getApps().find(a => a.name === 'finance')
  ? getApp('finance')
  : initializeApp(financeConfig, 'finance');

export const financeDb = getFirestore(financeApp);
