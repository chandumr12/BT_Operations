import axios from 'axios';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

export const BASE_URL = 'https://bt-ops-backend-257754693783.asia-south1.run.app/api';

const api = axios.create({ baseURL: BASE_URL });

// On native, Firebase Auth persists the session in AsyncStorage and has to
// rehydrate it asynchronously on cold start — `auth.currentUser` is null for
// a beat right after launch (and briefly right after login, before the SDK
// has finished updating its internal state). Screens like the dashboard fire
// their first API calls the instant they mount, which can race ahead of that
// rehydration: the request goes out with no Authorization header at all, and
// the backend's HTTPBearer dependency answers with a bare 403 "Not
// authenticated" — not because the user lacks permission, just because the
// token wasn't attached in time. Waiting for the first onAuthStateChanged
// event before letting any request through closes that race.
let resolveAuthReady: () => void;
const authReady = new Promise<void>((resolve) => { resolveAuthReady = resolve; });
onAuthStateChanged(auth, () => resolveAuthReady());

// Attach a fresh Firebase ID token before every request.
api.interceptors.request.use(async (config) => {
  await authReady;
  const user = auth.currentUser;
  if (user) {
    try {
      config.headers.Authorization = `Bearer ${await user.getIdToken()}`;
    } catch {
      // Transient token-fetch failure — try once more with a forced refresh
      // rather than silently sending the request unauthenticated.
      try {
        config.headers.Authorization = `Bearer ${await user.getIdToken(true)}`;
      } catch {}
    }
  }
  return config;
});

// Safety net: if a request still comes back unauthenticated/forbidden (e.g.
// an expired token that slipped through), force-refresh the token once and
// retry before surfacing the error to the UI.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status;
    const config = error?.config;
    if ((status === 401 || status === 403) && config && !config._retriedAuth && auth.currentUser) {
      config._retriedAuth = true;
      try {
        const token = await auth.currentUser.getIdToken(true);
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
        return api.request(config);
      } catch {}
    }
    return Promise.reject(error);
  }
);

export default api;
