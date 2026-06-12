import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PersonOutlineIcon from "@mui/icons-material/Person2Outlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import MicNoneIcon from "@mui/icons-material/MicNone";
import MicOffIcon from "@mui/icons-material/MicOff";
import HeadsetMicOutlinedIcon from "@mui/icons-material/HeadsetMicOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { getBranches } from "../../services/branch.service";
import { login as loginApi } from "../../services/auth.service";
import { useAuth } from "../../context/AuthContext";
import type { Branch } from "../../../lib/types";
import "./login.css";

const PREVIEW = [
  {
    nick: "오늘도합격",
    mic: true,
    g: "linear-gradient(135deg,#3f5b6e,#273d4d)",
  },
  {
    nick: "정리왕",
    mic: true,
    g: "linear-gradient(135deg,#6a8f6f,#4f7a5a)",
  },
  {
    nick: "해피스터디",
    mic: false,
    g: "linear-gradient(135deg,#7d7aa8,#5d5a88)",
  },
  {
    nick: "공부는내일",
    mic: false,
    g: "linear-gradient(135deg,#b08a4f,#8a6a2f)",
  },
  {
    nick: "꾸준히가자",
    mic: true,
    g: "linear-gradient(135deg,#5f8aa8,#3f6a88)",
  },
  {
    nick: "합격기원",
    mic: false,
    g: "linear-gradient(135deg,#a85f7a,#88405a)",
  },
  {
    nick: "포기하지마",
    mic: true,
    g: "linear-gradient(135deg,#6a8f6f,#4f7a5a)",
  },
  {
    nick: "노력은배신X",
    mic: false,
    g: "linear-gradient(135deg,#7d6a55,#5a4a38)",
  },
];

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [studyCount] = useState(() => Math.floor(Math.random() * 18) + 18);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [installPrompt, setInstallPrompt] = useState<any>(null);

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
      navigate("/waiting-room");
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
              src="/logo/logo-2.webp"
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
            자동로그인
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
          자격증공장 재택근무반 작업장 미리보기
        </span>

        <div className="login-grid">
          {PREVIEW.map((p, i) => (
            <div key={p.nick} className="login-cam" style={{ background: p.g }}>
              <span className="login-cam-ph">
                <PersonRoundedIcon />
              </span>

              <img
                className="login-cam-img"
                src={`/preview/${i + 1}.jpg`}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />

              <span className="login-cam-name">{p.nick}</span>

              <span className={`login-cam-mic${p.mic ? "" : " is-off"}`}>
                {p.mic ? <MicNoneIcon /> : <MicOffIcon />}
              </span>
            </div>
          ))}
        </div>

        <p className="login-count">
          <GroupsOutlinedIcon className="login-count-icon" />
          현재 {studyCount}명이 함께 공부 중이예요!
        </p>

        <p className="login-note">
          *본 미리보기는 가상 미리보기 화면이며, 등록 후 실제 작업장을 보실 수
          있습니다.
        </p>
      </section>

      <p className="app-foot">자격증공장 재택근무반</p>
    </main>
  );
}
