import axios from "axios";
import { API_BASE } from "../../lib/config";

export const http = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach the JWT from the saved session on every request.
http.interceptors.request.use((config) => {
  try {
    const raw =
      localStorage.getItem("jagong_session") ??
      sessionStorage.getItem("jagong_session");
    if (raw) {
      const token = JSON.parse(raw)?.token;
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // malformed session — ignore; AuthContext will clear it
  }
  return config;
});

// Surface the backend's (Korean) message on `.message`.
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const m = err?.response?.data?.message;
    const msg = Array.isArray(m)
      ? m.join(", ")
      : m || err.message || "요청에 실패했습니다";
    return Promise.reject(new Error(msg));
  },
);
