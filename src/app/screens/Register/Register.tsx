import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonOutlineIcon from "@mui/icons-material/Person2Outlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import { getBranches } from "../../services/branch.service";
import { register as registerApi } from "../../services/auth.service";
import { useAuth } from "../../context/AuthContext";
import { memberHomePath } from "../../utils/access";
import type { Branch } from "../../../lib/types";
import "./register.css";

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branchOpen, setBranchOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showPin2, setShowPin2] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [noInfo, setNoInfo] = useState(false);
  const [policyAgreed, setPolicyAgreed] = useState(false);

  useEffect(() => {
    getBranches()
      .then(setBranches)
      .catch(() => {});
  }, []);

  const selectedBranch = branches.find((b) => b.id === branchId);

  function resetForm() {
    setName("");
    setBranchId("");
    setBranchOpen(false);
    setPin("");
    setPin2("");
    setShowPin(false);
    setShowPin2(false);
    setPolicyAgreed(false);
    setErr("");
  }

  function closeNoInfoModal() {
    setNoInfo(false);
    resetForm();
  }

  async function submit() {
    setErr("");

    if (!name.trim()) return setErr("이름을 입력해주세요.");
    if (!branchId) return setErr("지역을 선택해주세요.");
    if (!/^\d{4}$/.test(pin)) return setErr("비밀번호는 숫자 4자리예요.");
    if (pin !== pin2) return setErr("비밀번호가 일치하지 않습니다.");
    if (!policyAgreed) return setErr("필수 약관 및 정책에 동의해주세요.");

    setBusy(true);

    try {
      const res = await registerApi(name.trim(), branchId, pin, policyAgreed);

      if (res.token) {
        login({ token: res.token, user: res.user }, false);
        navigate(memberHomePath(res.user), { replace: true });
      } else {
        navigate("/login");
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "회원가입을 완료하지 못했습니다.";
      if (message.includes("사전 등록")) {
        setNoInfo(true);
      } else {
        setErr(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="reg">
      <header className="reg-top">
        <button className="reg-back" onClick={() => navigate("/login")}>
          <ArrowBackIcon /> 뒤로가기
        </button>

        <h1 className="reg-title">사원등록</h1>

        <span className="reg-top-spacer" />
      </header>

      <div className="reg-body">
        <picture className="reg-logo-pic">
          <source
            media="(prefers-reduced-motion: reduce)"
            srcSet="/logo/logo-2.png"
          />

          <img
            className="reg-logo"
            src="/logo/logo-register1.png"
            alt="온라인 관리형독서실"
          />
        </picture>

        <label className="reg-label">이름</label>
        <div className="reg-field">
          <PersonOutlineIcon className="reg-field-icon" />

          <input
            className="reg-input"
            placeholder="이름을 입력하세요"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <label className="reg-label">지역</label>
        <div className="reg-field reg-branch-field">
          <button
            type="button"
            className={`reg-branch-button${branchId ? " is-selected" : ""}`}
            onClick={() => setBranchOpen((open) => !open)}
          >
            <PlaceOutlinedIcon className="reg-branch-icon" />

            <span>
              {selectedBranch ? selectedBranch.name : "지역을 선택하세요"}
            </span>

            <ExpandMoreIcon
              className={`reg-branch-chev${branchOpen ? " is-open" : ""}`}
            />
          </button>

          {branchOpen && (
            <div className="reg-branch-menu">
              {branches.map((b) => (
                <button
                  type="button"
                  key={b.id}
                  className={`reg-branch-option${
                    b.id === branchId ? " is-active" : ""
                  }`}
                  onClick={() => {
                    setBranchId(b.id);
                    setBranchOpen(false);
                  }}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="reg-label">비밀번호 4자리</label>
        <div className="reg-field">
          <LockOutlinedIcon className="reg-field-icon" />

          <input
            className="reg-input"
            type={showPin ? "text" : "password"}
            maxLength={4}
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />

          <button
            type="button"
            className="reg-eye"
            onClick={() => setShowPin((s) => !s)}
            aria-label="비밀번호 보기"
          >
            {showPin ? <VisibilityOffIcon /> : <VisibilityIcon />}
          </button>
        </div>

        <label className="reg-label">비밀번호 확인</label>
        <div className="reg-field">
          <LockOutlinedIcon className="reg-field-icon" />

          <input
            className="reg-input"
            type={showPin2 ? "text" : "password"}
            maxLength={4}
            inputMode="numeric"
            value={pin2}
            onChange={(e) => setPin2(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />

          <button
            type="button"
            className="reg-eye"
            onClick={() => setShowPin2((s) => !s)}
            aria-label="비밀번호 보기"
          >
            {showPin2 ? <VisibilityOffIcon /> : <VisibilityIcon />}
          </button>
        </div>

        <p className="reg-help">본인만 아는 비밀번호 4자리를 입력해주세요</p>

        <label className="reg-agree">
          <input
            type="checkbox"
            checked={policyAgreed}
            onChange={(event) => setPolicyAgreed(event.target.checked)}
          />
          <span>
            [필수] 서비스 이용약관, 개인정보 처리방침, 결제 및 환불정책,
            카메라 이용 동의, 운영수칙을 확인하고 동의합니다.
            <a href="/policies" target="_blank" rel="noreferrer">
              전문보기
            </a>
          </span>
        </label>

        {err && <div className="reg-error">{err}</div>}

        <button className="reg-submit" onClick={submit} disabled={busy}>
          {busy ? "확인 중…" : "확인"}
        </button>
      </div>

      {noInfo && (
        <div className="reg-modal-overlay" onClick={closeNoInfoModal}>
          <div className="reg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reg-modal-icon">
              <PriorityHighIcon />
            </div>

            <h2 className="reg-modal-title">등록 정보가 없습니다</h2>

            <p className="reg-modal-text">
              사전 등록 된 정보가 없습니다.
              <br />
              관리자에게 문의하세요.
            </p>

            <button className="reg-modal-btn" onClick={closeNoInfoModal}>
              확인
            </button>
          </div>
        </div>
      )}

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
