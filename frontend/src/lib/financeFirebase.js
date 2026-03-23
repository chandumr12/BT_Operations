// lib/financeFirebase.js
// Second Firebase app — points to the EXISTING bt-finance Firestore.
// All finance pages import { db, auth, storage } from here.
// ⚠️  DO NOT change projectId — this is what preserves your live finance data.

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const financeConfig = {
  apiKey:            "AIzaSyBzbycQjAkARU5Ft4ae-7lYuau1BuLDdyo",
  authDomain:        "bt-finance-41556.firebaseapp.com",
  projectId:         "bt-finance-41556",
  storageBucket:     "bt-finance-41556.firebasestorage.app",
  messagingSenderId: "209437203357",
  appId:             "1:209437203357:web:e4f1b889c4bff7e6afad74",
};

// Prevent duplicate app initialisation during hot-reload
const financeApp =
  getApps().find(a => a.name === 'finance') ??
  initializeApp(financeConfig, 'finance');

export const db      = getFirestore(financeApp);
export const storage = getStorage(financeApp);

// NOTE: Auth is NOT exported from here.
// Finance pages relied on firebase auth just for PrivateRoute guards.
// In BT Ops the ProtectedRoute + AuthContext handles auth for the whole app.