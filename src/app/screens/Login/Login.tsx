import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PersonOutlineIcon from "@mui/icons-material/Person2Outlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { getBranches } from "../../services/branch.service";
import { getMe, login as loginApi } from "../../services/auth.service";
import { useAuth } from "../../context/AuthContext";
import { memberHomePath } from "../../utils/access";
import type { Branch } from "../../../lib/types";
import "./login.css";

const AUTH_REMEMBER_KEY = "jagong_remember_login";
const STUDY_TILES = [
  {
    label: "변호사",
    tone: "is-coral",
    src: "https://assets.jagongonline.com/login/video1.mp4",
  },
  {
    label: "회계사",
    tone: "is-mint",
    src: "https://assets.jagongonline.com/login/video2.mp4",
  },
  {
    label: "감정평가사",
    tone: "is-navy",
    src: "https://assets.jagongonline.com/login/video3.mp4",
  },
  {
    label: "임용고시",
    tone: "is-gold",
    src: "https://assets.jagongonline.com/login/video4.mp4",
  },
  {
    label: "공무원",
    tone: "is-sage",
    src: "https://assets.jagongonline.com/login/video5.mp4",
  },
  {
    label: "공기업",
    tone: "is-blush",
    src: "https://assets.jagongonline.com/login/video6.mp4",
  },
];

export default function Login() {
  const navigate = useNavigate();
  const { login, session } = useAuth();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [autoLogin, setAutoLogin] = useState(
    () => localStorage.getItem(AUTH_REMEMBER_KEY) === "1",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    if (!session) return;
    navigate(memberHomePath(session.user), { replace: true });
  }, [navigate, session]);

  useEffect(() => {
    getBranches()
      .then((b) => {
        setBranches(b);
        if (b.length >= 1) setBranchId(b[0].id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function submit() {
    setError("");
    setBusy(true);

    try {
      const { token, user } = await loginApi(name, branchId, pin, autoLogin);
      login({ token, user }, autoLogin);
      try {
        const freshUser = await getMe();
        login({ token, user: freshUser }, autoLogin);
        navigate(memberHomePath(freshUser), { replace: true });
      } catch {
        navigate(memberHomePath(user), { replace: true });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function addToHome() {
    if (installPrompt) {
      installPrompt.prompt();
      setInstallPrompt(null);
    } else {
      alert('브라우저 메뉴의 "홈 화면에 추가"로 설치할 수 있어요.');
    }
  }

  return (
    <main className="login">
      <section className="login-shell">
        <header className="login-head">
          <div className="login-logo-wrap">
            <picture>
              <source
                media="(prefers-reduced-motion: reduce)"
                srcSet="/logo/logo-oneline-3.webp"
              />
              <img
                className="login-logo"
                src="/logo/logo-oneline-3.webp"
                alt="온라인 관리형독서실 · 자격증공장 재택근무반"
              />
            </picture>
          </div>
        </header>

        <div className="login-content">
          <section className="login-preview">
            <div className="login-student-grid" aria-hidden="true">
              {STUDY_TILES.map((tile) => (
                <article
                  className={`login-video-tile ${tile.tone}`}
                  key={tile.label}
                >
                  <span className="login-video-glow" />
                  <video
                    className="login-video-media"
                    src={tile.src}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    disablePictureInPicture
                  />
                  <span className="login-video-shade" />
                  <span className="login-student-label">{tile.label}</span>
                </article>
              ))}
            </div>

            <p className="login-ai-note">
              위 화면은 AI로 생성된 예시 영상입니다.
            </p>
          </section>

          <aside className="login-side">
            <section className="login-card">
              {branches.length > 1 && (
                <select
                  className="login-input login-select"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}

              <div className="login-field">
                <PersonOutlineIcon className="login-field-icon" />
                <input
                  className="login-input"
                  placeholder="아이디 · 이름"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="login-field">
                <LockOutlinedIcon className="login-field-icon" />
                <input
                  className="login-input"
                  type={showPin ? "text" : "password"}
                  placeholder="비밀번호 · 4자리"
                  maxLength={4}
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />

                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShowPin((s) => !s)}
                  aria-label="비밀번호 보기"
                >
                  {showPin ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </button>
              </div>

              <div className="login-row">
                <label className="login-check">
                  <input
                    type="checkbox"
                    checked={autoLogin}
                    onChange={(e) => setAutoLogin(e.target.checked)}
                  />
                  <span>
                    자동로그인
                    <small>
                      {autoLogin ? "다음 방문에도 유지" : "현재 세션만 유지"}
                    </small>
                  </span>
                </label>

                <button
                  type="button"
                  className="login-link"
                  onClick={() => navigate("/register")}
                >
                  사원등록 &gt;
                </button>
              </div>

              {error && <div className="login-error">{error}</div>}

              <button
                className="login-btn"
                disabled={busy || !name || !pin || !branchId}
                onClick={submit}
              >
                {busy ? "로그인 중..." : "로그인"}
              </button>

              <button
                className="login-btn login-btn-outline"
                onClick={addToHome}
              >
                <HomeOutlinedIcon className="login-btn-icon" />
                홈화면에 추가하기
              </button>
            </section>

            <button
              type="button"
              className="login-cta"
              onClick={() => navigate("/booking")}
              aria-label="궁금하신가요? 가입상담예약 신청하기"
            >
              <span className="login-cta-icon-wrap">
                <CalendarMonthOutlinedIcon className="login-cta-icon" />
              </span>
              <span className="login-cta-body">
                <strong>궁금한 점이 있으신가요?</strong>
                <em>가입상담예약</em>
              </span>
              <span className="login-cta-btn" aria-hidden="true">
                <ChevronRightIcon className="login-cta-chev" />
              </span>
            </button>
          </aside>
        </div>
      </section>

      <p className="app-foot">자격증공장 재택근무반</p>
    </main>
  );
}
