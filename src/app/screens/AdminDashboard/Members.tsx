import { useState } from "react";
import type { AdminUser, Branch, PageMeta } from "../../../lib/types";
import AdminPager from "./AdminPager";
import { dDayText, userDetail } from "./admin.utils";

type MemberEditForm = {
  phone: string;
  residenceArea: string;
  age: string;
  examType: string;
  prepDuration: string;
  notes: string;
  isActive: boolean;
};

type MembersProps = {
  users: AdminUser[];
  branches: Branch[];
  searchText: string;
  onSearchChange: (value: string) => void;
  onUserUpdate: (userId: string, input: Partial<AdminUser>) => Promise<void>;
  pageMeta: PageMeta;
  onPageChange: (page: number) => void;
};

function branchLabel(branches: Branch[], branchId?: string) {
  if (!branchId) return "지점 없음";
  const branch = branches.find((item) => item.id === branchId);
  return branch ? branch.name : "알 수 없는 지점";
}

export default function Members(props: MembersProps) {
  const {
    users,
    branches,
    searchText,
    onSearchChange,
    onUserUpdate,
    pageMeta,
    onPageChange,
  } = props;

  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState<MemberEditForm | null>(null);
  const [savingId, setSavingId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const members = users.filter((user) => user.role === "MEMBER");
  const selectedUser =
    members.find((user) => user.id === selectedId) ?? members[0] ?? null;

  function startEdit(user: AdminUser) {
    setEditingId(user.id);
    setEditForm({
      phone: user.phone ?? "",
      residenceArea: user.residenceArea ?? "",
      age: user.age ? String(user.age) : "",
      examType: user.examType ?? "",
      prepDuration: user.prepDuration ?? "",
      notes: user.notes ?? "",
      isActive: Boolean(user.isActive),
    });
  }

  function updateEdit(field: keyof MemberEditForm, value: string | boolean) {
    setEditForm((current) =>
      current ? { ...current, [field]: value } : current,
    );
  }

  async function saveEdit(userId: string) {
    if (!editForm || savingId) return;
    setSavingId(userId);
    try {
      await onUserUpdate(userId, {
        phone: editForm.phone.trim() || null,
        residenceArea: editForm.residenceArea.trim() || null,
        age: editForm.age ? Number(editForm.age) : null,
        examType: editForm.examType.trim() || null,
        prepDuration: editForm.prepDuration.trim() || null,
        notes: editForm.notes.trim() || null,
        isActive: editForm.isActive,
      });
      setEditingId("");
      setEditForm(null);
    } finally {
      setSavingId("");
    }
  }

  return (
    <section className="admin-card admin-member-directory">
      <div className="admin-member-directory-head">
        <h2>회원 관리</h2>
        <span>{pageMeta.total}명</span>
      </div>

      <label className="admin-member-directory-search">
        <span>회원 검색</span>
        <input
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="이름, 연락처, 자격증, 지역 검색"
        />
      </label>

      <div className="admin-member-directory-workspace">
        <div className="admin-member-directory-results">
          <div className="admin-member-directory-list">
            <div
              className="admin-member-directory-list-head"
              aria-hidden="true"
            >
              <span>회원</span>
              <span>준비기간</span>
              <span>이용권</span>
              <span>상태</span>
              <span />
            </div>
            {members.length === 0 && (
              <div className="admin-member-directory-empty">
                등록된 회원이 없습니다.
              </div>
            )}
            {members.map((user) => (
              <button
                className={`admin-member-directory-row${selectedUser?.id === user.id ? " is-selected" : ""}`}
                key={user.id}
                onClick={() => {
                  setSelectedId(user.id);
                  setEditingId("");
                  setEditForm(null);
                }}
                type="button"
              >
                <span className="admin-member-directory-main">
                  <span
                    className="admin-member-directory-avatar"
                    aria-hidden="true"
                  >
                    {user.name.slice(0, 1)}
                  </span>
                  <span className="admin-member-directory-identity">
                    <strong>{user.name}</strong>
                    <small>{branchLabel(branches, user.branchId)}</small>
                  </span>
                </span>
                <span className="admin-member-directory-plan">
                  {userDetail(user.prepDuration)}
                </span>
                <span className="admin-member-directory-expiry">
                  {dDayText(user.membershipEnd)}
                </span>
                <em className={user.isActive ? "is-active" : "is-pending"}>
                  {user.isActive ? "활성" : "대기"}
                </em>
                <span
                  className="admin-member-directory-chevron"
                  aria-hidden="true"
                >
                  ›
                </span>
              </button>
            ))}
          </div>
          <AdminPager meta={pageMeta} onPageChange={onPageChange} />
        </div>

        {selectedUser && (
          <aside className="admin-member-directory-detail">
            <div className="admin-member-directory-detail-head">
              <div>
                <span
                  className="admin-member-directory-avatar"
                  aria-hidden="true"
                >
                  {selectedUser.name.slice(0, 1)}
                </span>
                <div>
                  <strong>{selectedUser.name}</strong>
                  <span>{branchLabel(branches, selectedUser.branchId)}</span>
                </div>
              </div>
              <em
                className={selectedUser.isActive ? "is-active" : "is-pending"}
              >
                {selectedUser.isActive ? "활성" : "대기"}
              </em>
            </div>

            {editingId === selectedUser.id && editForm ? (
              <div className="admin-member-directory-edit">
                <label>
                  연락처
                  <input
                    value={editForm.phone}
                    onChange={(event) =>
                      updateEdit("phone", event.target.value)
                    }
                  />
                </label>
                <label>
                  거주지역
                  <input
                    value={editForm.residenceArea}
                    onChange={(event) =>
                      updateEdit("residenceArea", event.target.value)
                    }
                  />
                </label>
                <label>
                  나이
                  <input
                    inputMode="numeric"
                    value={editForm.age}
                    onChange={(event) => updateEdit("age", event.target.value)}
                  />
                </label>
                <label>
                  자격증
                  <input
                    value={editForm.examType}
                    onChange={(event) =>
                      updateEdit("examType", event.target.value)
                    }
                  />
                </label>
                <label>
                  준비기간
                  <input
                    value={editForm.prepDuration}
                    onChange={(event) =>
                      updateEdit("prepDuration", event.target.value)
                    }
                  />
                </label>
                <label className="admin-member-directory-edit-note">
                  메모
                  <input
                    value={editForm.notes}
                    onChange={(event) =>
                      updateEdit("notes", event.target.value)
                    }
                  />
                </label>
                <label className="admin-member-directory-check">
                  <input
                    checked={editForm.isActive}
                    onChange={(event) =>
                      updateEdit("isActive", event.target.checked)
                    }
                    type="checkbox"
                  />
                  활성 회원
                </label>
                <div className="admin-member-directory-actions">
                  <button
                    disabled={savingId === selectedUser.id}
                    onClick={() => saveEdit(selectedUser.id)}
                    type="button"
                  >
                    {savingId === selectedUser.id ? "저장중" : "저장"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingId("");
                      setEditForm(null);
                    }}
                    type="button"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <>
                <dl className="admin-member-directory-fields">
                  <div>
                    <dt>나이</dt>
                    <dd>{userDetail(selectedUser.age)}</dd>
                  </div>
                  <div>
                    <dt>거주지역</dt>
                    <dd>{userDetail(selectedUser.residenceArea)}</dd>
                  </div>
                  <div>
                    <dt>자격증</dt>
                    <dd>{userDetail(selectedUser.examType)}</dd>
                  </div>
                  <div>
                    <dt>준비기간</dt>
                    <dd>{userDetail(selectedUser.prepDuration)}</dd>
                  </div>
                  <div>
                    <dt>이용권</dt>
                    <dd>{dDayText(selectedUser.membershipEnd)}</dd>
                  </div>
                </dl>
                <button
                  className="admin-member-directory-edit-button"
                  onClick={() => startEdit(selectedUser)}
                  type="button"
                >
                  회원 정보 수정
                </button>
              </>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}
