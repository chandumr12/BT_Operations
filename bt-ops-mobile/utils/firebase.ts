import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            'AIzaSyCFl3n1PmSTN6eO4NdNDevIvFAmO78fV_M',
  authDomain:        'bengaluru-trekkers-ops.firebaseapp.com',
  projectId:         'bengaluru-trekkers-ops',
  storageBucket:     'bengaluru-trekkers-ops.firebasestorage.app',
  messagingSenderId: '257754693783',
  appId:             '1:257754693783:web:56d100167617bc1ef769d2',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
