import axios from 'axios';
import { auth } from './firebase';

export const BASE_URL = 'https://bt-ops-backend-257754693783.asia-south1.run.app/api';

const api = axios.create({ baseURL: BASE_URL });

// Attach fresh Firebase ID token before every request
api.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

export default api;
