import axios from "axios";
import { API_BASE } from "../../lib/config";

export const http = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

let activeAuthToken: string | null = null;

export function setHttpAuthToken(token: string | null): void {
  activeAuthToken = token;
}

function koreanErrorMessage(err: unknown) {
  if (!axios.isAxiosError(err)) return "요청 처리 중 오류가 발생했습니다.";

  const status = err.response?.status;
  const message = err.response?.data?.message;
  const backendMessage = Array.isArray(message)
    ? message.join(", ")
    : typeof message === "string"
      ? message
      : "";

  if (backendMessage) return backendMessage;

  if (!err.response) {
    return "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.";
  }

  if (status === 400) return "입력값을 다시 확인해주세요.";
  if (status === 401) return "로그인이 필요합니다. 다시 로그인해주세요.";
  if (status === 403) return "이 기능을 사용할 권한이 없습니다.";
  if (status === 404) return "요청한 정보를 찾을 수 없습니다.";
  if (status && status >= 500) {
    return "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }

  return "요청에 실패했습니다. 잠시 후 다시 시도해주세요.";
}

// AuthContext owns the effective per-tab identity. Do not independently read
// browser storage here: a tab-local session may intentionally shadow another
// account's remembered browser session.
http.interceptors.request.use((config) => {
  if (activeAuthToken) {
    config.headers.Authorization = `Bearer ${activeAuthToken}`;
  }
  return config;
});

// Surface the backend's (Korean) message on `.message`.
http.interceptors.response.use(
  (res) => res,
  (err) => {
    return Promise.reject(new Error(koreanErrorMessage(err)));
  },
);
