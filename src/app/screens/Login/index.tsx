import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PersonOutlineIcon from "@mui/icons-material/Person2Outlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import MicNoneIcon from "@mui/icons-material/MicNone";
import MicOffIcon from "@mui/icons-material/MicOff";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import AddToHomeScreenIcon from "@mui/icons-material/AddToHomeScreen";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { getBranches, login as loginApi } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import type { Branch } from "../../../lib/types";
import "./login.css";

const PREVIEW = [
  {
    nick: "오늘도합격",
    mic: true,
    g: "linear-gradient(135deg,#c2693a,#9a4f2a)",
  },
  { nick: "정리왕", mic: true, g: "linear-gradient(135deg,#6a8f6f,#4f7a5a)" },
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
  const [autoLogin, setAutoLogin] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
      navigate("/");
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
    } else alert('브라우저 메뉴의 "홈 화면에 추가"로 설치할 수 있어요.');
  }

  return (
    <div className="login">
      <div className="login-wrap">
        <header className="login-head">
          <h1 className="login-brand-title">자격증공장 재택근무반</h1>
          <p className="login-brand-sub">전국 성인 수험생 온라인 공동 학습</p>
        </header>

        <section className="login-card">
          <div className="login-mascot-wrap">
            <svg
              className="login-mascot"
              viewBox="0 0 200 140"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <ellipse className="lm-glow" cx="100" cy="58" rx="48" ry="34" />
              <g className="lm-student">
                <path
                  className="lm-body"
                  d="M74 102 Q74 78 100 78 Q126 78 126 102 Z"
                />
                <g className="lm-head">
                  <circle className="lm-face" cx="100" cy="60" r="15" />
                  <path
                    className="lm-hair"
                    d="M85 58 A15 15 0 0 1 115 58 Q100 47 85 58 Z"
                  />
                  <circle className="lm-eye" cx="95" cy="61" r="1.8" />
                  <circle className="lm-eye" cx="105" cy="61" r="1.8" />
                  <path className="lm-smile" d="M96 67 Q100 70 104 67" />
                </g>
              </g>
              <rect
                className="lm-desk"
                x="24"
                y="100"
                width="152"
                height="9"
                rx="4"
              />
              <rect
                className="lm-desk-front"
                x="30"
                y="107"
                width="140"
                height="16"
                rx="3"
              />
              <g className="lm-book">
                <path className="lm-page" d="M62 101 L100 93 L100 101 Z" />
                <path className="lm-page" d="M138 101 L100 93 L100 101 Z" />
                <line className="lm-bline" x1="70" y1="98" x2="92" y2="95" />
                <line className="lm-bline" x1="108" y1="95" x2="130" y2="98" />
              </g>
              <g className="lm-arm">
                <path className="lm-arm-shape" d="M90 86 L107 95" />
                <circle className="lm-hand" cx="108" cy="95" r="4" />
                <line className="lm-pencil" x1="108" y1="95" x2="118" y2="99" />
              </g>
              <g className="lm-cup">
                <path
                  className="lm-steam"
                  d="M150 80 q5 -5 0 -10 q-5 -5 0 -10"
                />
                <rect
                  className="lm-cup-body"
                  x="143"
                  y="86"
                  width="16"
                  height="13"
                  rx="3"
                />
                <path
                  className="lm-cup-handle"
                  d="M159 89 q6 1 6 5 q0 4 -6 5"
                />
              </g>
            </svg>
          </div>

          <h2 className="login-title">로그인</h2>
          <div className="login-title-bar" />

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
              className="login-input has-icon"
              placeholder="아이디: 이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="login-field">
            <LockOutlinedIcon className="login-field-icon" />
            <input
              className="login-input has-icon"
              type={showPin ? "text" : "password"}
              placeholder="비밀번호: 4자리"
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
              onClick={() => navigate("/booking")}
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
            {busy ? "로그인 중…" : "로그인"}
          </button>
          <button className="login-btn login-btn-outline" onClick={addToHome}>
            <AddToHomeScreenIcon className="login-btn-icon" /> 홈화면에 추가하기
          </button>

          <div className="login-cta">
            <div className="login-cta-head">
              <LightbulbOutlinedIcon className="login-cta-icon" />
              <p className="login-cta-text">
                수험생연구소에서, 친절 상담 후 등록해 드리고 있어요.
              </p>
            </div>
            <button
              className="login-cta-btn"
              onClick={() => navigate("/booking")}
            >
              가입상담예약 &nbsp;&gt;
            </button>
          </div>
        </section>

        <section className="login-preview">
          <span className="login-preview-badge">
            자격증공장 재택근무반 작업장 미리보기
          </span>
          <div className="login-preview-grid">
            {PREVIEW.map((p) => (
              <div
                key={p.nick}
                className="login-cam"
                style={{ background: p.g }}
              >
                <span className="login-cam-name">{p.nick}</span>
                {p.mic ? (
                  <MicNoneIcon className="login-cam-mic" />
                ) : (
                  <MicOffIcon className="login-cam-mic" />
                )}
              </div>
            ))}
          </div>
          <p className="login-preview-count">
            <FiberManualRecordIcon className="login-dot" /> 현재 23명이 함께
            공부 중이예요!
          </p>
          <p className="login-preview-note">
            *본 미리보기는 가상 미리보기 화면이며, 등록 후 실제 작업장을 보실 수
            있습니다.
          </p>
        </section>

        <p className="login-foot">jagong-client · dev build</p>
      </div>
    </div>
  );
}
