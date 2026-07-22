import { useState } from "react";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import ArrowForwardIosOutlinedIcon from "@mui/icons-material/ArrowForwardIosOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import type { AdminUser, Branch } from "../../../lib/types";
import type { MemberRegistrationTarget } from "./admin.types";

type ProfileForm = {
  name: string;
  phone: string;
  residenceArea: string;
  examType: string;
  prepDuration: string;
  password: string;
  passwordConfirm: string;
};

type MemberRegistrationForm = {
  consultationId: string;
  name: string;
  branchId: string;
  phone: string;
  residenceArea: string;
  age: string;
  examType: string;
  prepDuration: string;
  notes: string;
};

type StaffRegistrationForm = {
  name: string;
  password: string;
  branchId: string;
  phone: string;
};

type ProfileProps = {
  user: AdminUser | null;
  branches: Branch[];
  onSave: (input: Partial<ProfileForm>) => Promise<void>;
  preRegister?: MemberRegistrationForm;
  staffForm?: StaffRegistrationForm;
  onPreRegisterChange?: (
    field: keyof MemberRegistrationForm,
    value: string,
  ) => void;
  onPreRegisterSubmit?: () => void;
  onStaffChange?: (field: keyof StaffRegistrationForm, value: string) => void;
  onStaffSubmit?: () => void;
  pendingRegistrationTarget?: MemberRegistrationTarget | null;
  onRegistrationTargetHandled?: () => void;
};

function branchName(branches: Branch[], branchId?: string | null) {
  return branches.find((branch) => branch.id === branchId)?.name ?? "지점 없음";
}

function profileForm(user: AdminUser | null): ProfileForm {
  return {
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    residenceArea: user?.residenceArea ?? "",
    examType: user?.examType ?? "",
    prepDuration: user?.prepDuration ?? "",
    password: "",
    passwordConfirm: "",
  };
}

export default function Profile({
  user,
  branches,
  onSave,
  preRegister,
  staffForm,
  onPreRegisterChange,
  onPreRegisterSubmit,
  onStaffChange,
  onStaffSubmit,
  pendingRegistrationTarget,
  onRegistrationTargetHandled,
}: ProfileProps) {
  /** STATE **/
  const [form, setForm] = useState<ProfileForm>(() => profileForm(user));
  const [saving, setSaving] = useState(false);
  const [registrationTarget, setRegistrationTarget] =
    useState<MemberRegistrationTarget | null>(null);

  /** DERIVED **/
  const passwordInvalid =
    form.password.length > 0 && form.password.length !== 4;
  const passwordMismatch =
    form.password.length > 0 && form.password !== form.passwordConfirm;
  const cannotSave =
    saving || !form.name.trim() || passwordInvalid || passwordMismatch;
  const activeRegistrationTarget =
    registrationTarget ?? pendingRegistrationTarget ?? null;

  /** HANDLERS **/
  function update(field: keyof ProfileForm, value: string) {
    const nextValue =
      field === "password" || field === "passwordConfirm"
        ? value.replace(/\D/g, "").slice(0, 4)
        : value;
    setForm((current) => ({ ...current, [field]: nextValue }));
  }

  function openRegistration(target: MemberRegistrationTarget) {
    setRegistrationTarget(target);
    onRegistrationTargetHandled?.();
  }

  function closeRegistration() {
    setRegistrationTarget(null);
    onRegistrationTargetHandled?.();
  }

  async function save() {
    if (!user || cannotSave) return;
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        residenceArea: form.residenceArea.trim() || undefined,
        examType: form.examType.trim() || undefined,
        prepDuration: form.prepDuration.trim() || undefined,
        password: form.password.length === 4 ? form.password : undefined,
      });
      setForm((current) => ({
        ...current,
        password: "",
        passwordConfirm: "",
      }));
    } finally {
      setSaving(false);
    }
  }

  /** RENDER **/
  return (
    <section className="admin-card admin-profile-card">
      <div className="admin-section-head">
        <h2>
          <AccountCircleOutlinedIcon /> 내 정보
        </h2>
        <span>{user?.role ?? "계정"}</span>
      </div>

      <div className="admin-profile-summary">
        <strong>{user?.name ?? "관리 계정"}</strong>
        <span>{branchName(branches, user?.branchId)}</span>
      </div>

      {preRegister && staffForm && (
        <section className="admin-profile-management">
          <div className="admin-profile-management-head">
            <div>
              <strong>운영 관리</strong>
              <span>회원과 직원 등록을 바로 시작할 수 있습니다.</span>
            </div>
          </div>
          <div className="admin-profile-management-actions">
            <button
              aria-expanded={activeRegistrationTarget === "member"}
              onClick={() => openRegistration("member")}
              type="button"
            >
              <PersonAddAlt1OutlinedIcon />
              <span>
                <strong>회원 사전등록</strong>
                <small>회원 정보와 지점을 먼저 연결</small>
              </span>
              <ArrowForwardIosOutlinedIcon />
            </button>
            <button
              className="is-staff"
              aria-expanded={activeRegistrationTarget === "staff"}
              onClick={() => openRegistration("staff")}
              type="button"
            >
              <BadgeOutlinedIcon />
              <span>
                <strong>직원 등록</strong>
                <small>캠과 문의 업무 담당자 추가</small>
              </span>
              <ArrowForwardIosOutlinedIcon />
            </button>
          </div>
        </section>
      )}

      {preRegister &&
        onPreRegisterChange &&
        onPreRegisterSubmit &&
        activeRegistrationTarget === "member" && (
          <section className="admin-profile-registration">
            <div className="admin-profile-registration-head">
              <div>
                <strong>회원 사전등록</strong>
                <span>상담 후 회원 정보와 지점을 먼저 연결합니다.</span>
              </div>
              <button
                aria-label="회원 사전등록 닫기"
                onClick={closeRegistration}
                type="button"
              >
                <CloseOutlinedIcon />
              </button>
            </div>

            <div className="admin-profile-registration-grid">
              <label>
                이름
                <input
                  value={preRegister.name}
                  onChange={(event) =>
                    onPreRegisterChange("name", event.target.value)
                  }
                  placeholder="회원 이름"
                />
              </label>
              <label>
                지점
                <select
                  value={preRegister.branchId}
                  onChange={(event) =>
                    onPreRegisterChange("branchId", event.target.value)
                  }
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                연락처
                <input
                  value={preRegister.phone}
                  onChange={(event) =>
                    onPreRegisterChange("phone", event.target.value)
                  }
                  placeholder="010-0000-0000"
                />
              </label>
              <label>
                거주지역
                <input
                  value={preRegister.residenceArea}
                  onChange={(event) =>
                    onPreRegisterChange("residenceArea", event.target.value)
                  }
                  placeholder="예) 서울 / 수원"
                />
              </label>
              <label>
                나이
                <input
                  inputMode="numeric"
                  value={preRegister.age}
                  onChange={(event) =>
                    onPreRegisterChange("age", event.target.value)
                  }
                  placeholder="선택"
                />
              </label>
              <label>
                준비자격증
                <input
                  value={preRegister.examType}
                  onChange={(event) =>
                    onPreRegisterChange("examType", event.target.value)
                  }
                  placeholder="예) 세무사"
                />
              </label>
              <label>
                준비한기간
                <input
                  value={preRegister.prepDuration}
                  onChange={(event) =>
                    onPreRegisterChange("prepDuration", event.target.value)
                  }
                  placeholder="예) 6개월"
                />
              </label>
              <label className="admin-profile-registration-wide">
                메모
                <input
                  value={preRegister.notes}
                  onChange={(event) =>
                    onPreRegisterChange("notes", event.target.value)
                  }
                  placeholder="관리자 메모"
                />
              </label>
            </div>

            <button
              className="admin-profile-registration-submit"
              onClick={onPreRegisterSubmit}
              type="button"
            >
              사전등록 저장
            </button>
          </section>
        )}

      {staffForm &&
        onStaffChange &&
        onStaffSubmit &&
        activeRegistrationTarget === "staff" && (
          <section className="admin-profile-registration is-staff">
            <div className="admin-profile-registration-head">
              <div>
                <strong>직원 등록</strong>
                <span>직원은 캠 모니터와 문의 답변만 사용할 수 있습니다.</span>
              </div>
              <button
                aria-label="직원 등록 닫기"
                onClick={closeRegistration}
                type="button"
              >
                <CloseOutlinedIcon />
              </button>
            </div>

            <div className="admin-profile-registration-grid">
              <label>
                이름
                <input
                  value={staffForm.name}
                  onChange={(event) =>
                    onStaffChange("name", event.target.value)
                  }
                  placeholder="직원 이름"
                />
              </label>
              <label>
                비밀번호 4자리
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={staffForm.password}
                  onChange={(event) =>
                    onStaffChange("password", event.target.value)
                  }
                  placeholder="0000"
                />
              </label>
              <label>
                지점
                <select
                  value={staffForm.branchId}
                  onChange={(event) =>
                    onStaffChange("branchId", event.target.value)
                  }
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                연락처
                <input
                  value={staffForm.phone}
                  onChange={(event) =>
                    onStaffChange("phone", event.target.value)
                  }
                  placeholder="선택"
                />
              </label>
            </div>

            <button
              className="admin-profile-registration-submit"
              onClick={onStaffSubmit}
              type="button"
            >
              직원 등록
            </button>
          </section>
        )}

      <div className="admin-profile-grid">
        <label>
          이름
          <input
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
          />
        </label>
        <label>
          연락처
          <input
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
          />
        </label>
        <label>
          거주지역
          <input
            value={form.residenceArea}
            onChange={(event) => update("residenceArea", event.target.value)}
          />
        </label>
        <label>
          자격증
          <input
            value={form.examType}
            onChange={(event) => update("examType", event.target.value)}
          />
        </label>
        <label>
          준비기간
          <input
            value={form.prepDuration}
            onChange={(event) => update("prepDuration", event.target.value)}
          />
        </label>
        <label>
          새 비밀번호 4자리
          <input
            inputMode="numeric"
            maxLength={4}
            type="password"
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            placeholder="변경할 때만 입력"
          />
          {passwordInvalid && (
            <small className="admin-profile-hint is-error">
              비밀번호는 4자리로 입력해주세요.
            </small>
          )}
        </label>
        <label>
          새 비밀번호 확인
          <input
            inputMode="numeric"
            maxLength={4}
            type="password"
            value={form.passwordConfirm}
            onChange={(event) => update("passwordConfirm", event.target.value)}
            placeholder="한 번 더 입력"
          />
          {passwordMismatch && (
            <small className="admin-profile-hint is-error">
              비밀번호 확인이 일치하지 않습니다.
            </small>
          )}
        </label>
      </div>

      <button
        className="admin-profile-save"
        disabled={cannotSave}
        onClick={save}
        type="button"
      >
        {saving ? "저장중" : "내 정보 저장"}
      </button>
    </section>
  );
}
