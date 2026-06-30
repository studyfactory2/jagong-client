import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PersonOutlineIcon from "@mui/icons-material/Person2Outlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import HeadsetMicOutlinedIcon from "@mui/icons-material/HeadsetMicOutlined";
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
      const { token, user } = await loginApi(name, branchId, pin);
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
      <header className="login-head">
        <div className="login-logo-wrap">
          <picture>
            <source
              media="(prefers-reduced-motion: reduce)"
              srcSet="/logo/logo-2.png"
            />
            <img
              className="login-logo"
              src="/logo/logo-blush.webp"
              alt="온라인 관리형독서실 · 자격증공장 재택근무반"
            />
          </picture>
        </div>
      </header>

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

        <button className="login-btn login-btn-outline" onClick={addToHome}>
          <HomeOutlinedIcon className="login-btn-icon" />
          홈화면에 추가하기
        </button>

        <div className="login-cta">
          <HeadsetMicOutlinedIcon className="login-cta-icon" />

          <p className="login-cta-text">
            수험생연구소에서,
            <br />
            친절 상담 후 등록해
            <br />
            드리고 있어요.
          </p>

          <button
            className="login-cta-btn"
            onClick={() => navigate("/booking")}
          >
            <CalendarMonthOutlinedIcon />
            가입상담예약
            <ChevronRightIcon className="login-cta-chev" />
          </button>
        </div>
      </section>

      <section className="login-preview">
        <span className="login-preview-badge">
          자격증공장 재택근무반 온라인 작업장
        </span>

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

        <p className="login-count">
          로그인 후 실제 입장 현황을 확인하세요.
        </p>

        <p className="login-note">
          입장 후에는 오늘의 출석, 학습장, 캠 작업실을 바로 확인할 수 있습니다.
        </p>

        <p className="login-ai-note">
          AI 연출 영상이며 실제 회원 화면이 아닙니다.
        </p>
      </section>

      <p className="app-foot">자격증공장 재택근무반</p>
    </main>
  );
}
