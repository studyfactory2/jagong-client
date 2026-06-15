import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useAuth } from "../../context/AuthContext";
import { updateMyProfile } from "../../services/auth.service";
import type { AuthUser } from "../../../lib/types";
import "./my-page.css";

type ProfileForm = {
  name: string;
  phone: string;
  residenceArea: string;
  examType: string;
  prepDuration: string;
  password: string;
};

function fromUser(user?: AuthUser | null): ProfileForm {
  return {
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    residenceArea: user?.residenceArea ?? "",
    examType: user?.examType ?? "",
    prepDuration: user?.prepDuration ?? "",
    password: "",
  };
}

export default function MyPage() {
  /** STATE **/
  const navigate = useNavigate();
  const { session, refreshUser } = useAuth();
  const [form, setForm] = useState<ProfileForm>(() => fromUser(session?.user));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /** DERIVED **/
  const passwordInvalid = form.password.length > 0 && form.password.length !== 4;
  const membershipText = session?.user.membershipEnd
    ? new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(session.user.membershipEnd))
    : "이용권 없음";

  /** HANDLERS **/
  function update(field: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    if (!form.name.trim() || passwordInvalid || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateMyProfile({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        residenceArea: form.residenceArea.trim() || undefined,
        examType: form.examType.trim() || undefined,
        prepDuration: form.prepDuration.trim() || undefined,
        password: form.password.length === 4 ? form.password : undefined,
      });
      refreshUser(updated);
      setForm({ ...fromUser(updated), password: "" });
      setMessage("내 정보가 저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "내 정보를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  /** RENDER **/
  return (
    <div className="mp">
      <header className="mp-head">
        <button onClick={() => navigate("/waiting-room")} type="button">
          <ArrowBackIcon /> 대기장
        </button>
        <h1>내 정보</h1>
        <button onClick={save} disabled={saving || !form.name.trim() || passwordInvalid} type="button">
          {saving ? "저장중" : "저장"}
        </button>
      </header>

      <main className="mp-body">
        <section className="mp-hero">
          <AccountCircleOutlinedIcon />
          <div>
            <strong>{session?.user.name ?? "회원"}</strong>
            <span>{session?.user.role ?? "MEMBER"} · 만료일 {membershipText}</span>
          </div>
        </section>

        {(message || error) && (
          <p className={error ? "mp-alert is-error" : "mp-alert"}>
            {error || message}
          </p>
        )}

        <section className="mp-card">
          <h2>기본 정보</h2>
          <div className="mp-grid">
            <label>
              <span><BadgeOutlinedIcon /> 이름</span>
              <input value={form.name} onChange={(event) => update("name", event.target.value)} />
            </label>
            <label>
              <span><PhoneOutlinedIcon /> 연락처</span>
              <input value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="010-0000-0000" />
            </label>
            <label>
              <span><PlaceOutlinedIcon /> 거주지역</span>
              <input value={form.residenceArea} onChange={(event) => update("residenceArea", event.target.value)} placeholder="예) 서울 강남구" />
            </label>
            <label>
              <span><SchoolOutlinedIcon /> 준비 자격증</span>
              <input value={form.examType} onChange={(event) => update("examType", event.target.value)} placeholder="예) 노무사" />
            </label>
            <label>
              <span><TimerOutlinedIcon /> 준비기간</span>
              <input value={form.prepDuration} onChange={(event) => update("prepDuration", event.target.value)} placeholder="예) 6개월" />
            </label>
            <label>
              <span><LockOutlinedIcon /> 새 비밀번호 4자리</span>
              <input
                inputMode="numeric"
                maxLength={4}
                value={form.password}
                onChange={(event) => update("password", event.target.value.replace(/\D/g, ""))}
                placeholder="변경할 때만 입력"
              />
              {passwordInvalid && <em>비밀번호는 4자리로 입력해주세요.</em>}
            </label>
          </div>
        </section>

        <section className="mp-card mp-note">
          <h2>안내</h2>
          <p>이름, 연락처, 거주지역, 준비 자격증, 준비기간은 관리자 화면에도 함께 표시됩니다.</p>
          <p>비밀번호는 새 4자리를 입력한 경우에만 변경됩니다.</p>
        </section>
      </main>

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
