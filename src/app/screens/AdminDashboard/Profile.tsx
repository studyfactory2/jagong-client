import { useEffect, useState } from "react";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import type { AdminUser, Branch } from "../../../lib/types";

type ProfileForm = {
  name: string;
  phone: string;
  residenceArea: string;
  examType: string;
  prepDuration: string;
  password: string;
};

type ProfileProps = {
  user: AdminUser | null;
  branches: Branch[];
  onSave: (input: Partial<ProfileForm>) => Promise<void>;
};

function branchName(branches: Branch[], branchId?: string | null) {
  return branches.find((branch) => branch.id === branchId)?.name ?? "지점 없음";
}

export default function Profile({ user, branches, onSave }: ProfileProps) {
  /** STATE **/
  const [form, setForm] = useState<ProfileForm>({
    name: "",
    phone: "",
    residenceArea: "",
    examType: "",
    prepDuration: "",
    password: "",
  });
  const [saving, setSaving] = useState(false);

  /** EFFECTS **/
  useEffect(() => {
    setForm({
      name: user?.name ?? "",
      phone: user?.phone ?? "",
      residenceArea: user?.residenceArea ?? "",
      examType: user?.examType ?? "",
      prepDuration: user?.prepDuration ?? "",
      password: "",
    });
  }, [user?.id, user?.userId]);

  /** HANDLERS **/
  function update(field: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    if (!user || saving || !form.name.trim()) return;
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
      setForm((current) => ({ ...current, password: "" }));
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

      <div className="admin-profile-grid">
        <label>
          이름
          <input value={form.name} onChange={(event) => update("name", event.target.value)} />
        </label>
        <label>
          연락처
          <input value={form.phone} onChange={(event) => update("phone", event.target.value)} />
        </label>
        <label>
          거주지역
          <input value={form.residenceArea} onChange={(event) => update("residenceArea", event.target.value)} />
        </label>
        <label>
          자격증
          <input value={form.examType} onChange={(event) => update("examType", event.target.value)} />
        </label>
        <label>
          준비기간
          <input value={form.prepDuration} onChange={(event) => update("prepDuration", event.target.value)} />
        </label>
        <label>
          새 비밀번호 4자리
          <input
            inputMode="numeric"
            maxLength={4}
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            placeholder="변경할 때만 입력"
          />
        </label>
      </div>

      <button className="admin-profile-save" disabled={saving || !form.name.trim()} onClick={save} type="button">
        {saving ? "저장중" : "내 정보 저장"}
      </button>
    </section>
  );
}
