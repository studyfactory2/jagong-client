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
  const members = users.filter((user) => user.role === "MEMBER");

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
    <section className="admin-card admin-members-card">
      <div className="admin-section-head">
        <h2>회원 관리</h2>
        <span>{pageMeta.total}명</span>
      </div>

      <label className="admin-search">
        <span>회원 검색</span>
        <input
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="이름, 연락처, 자격증, 지역 검색"
        />
      </label>

      <div className="admin-member-list">
        {members.length === 0 && (
          <div className="admin-list-empty">등록된 회원이 없습니다.</div>
        )}
        {members.map((user) => {
          const editing = editingId === user.id && editForm;
          return (
            <article className="admin-member-card" key={user.id}>
              <div className="admin-member-main">
                <strong>{user.name}</strong>
                <span>{branchLabel(branches, user.branchId)}</span>
              </div>

              {editing ? (
                <div className="admin-member-edit">
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
                      onChange={(event) =>
                        updateEdit("age", event.target.value)
                      }
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
                  <label>
                    메모
                    <input
                      value={editForm.notes}
                      onChange={(event) =>
                        updateEdit("notes", event.target.value)
                      }
                    />
                  </label>
                  <label className="admin-member-check">
                    <input
                      checked={editForm.isActive}
                      onChange={(event) =>
                        updateEdit("isActive", event.target.checked)
                      }
                      type="checkbox"
                    />{" "}
                    활성 회원
                  </label>
                  <div className="admin-member-actions">
                    <button
                      disabled={savingId === user.id}
                      onClick={() => saveEdit(user.id)}
                      type="button"
                    >
                      {savingId === user.id ? "저장중" : "저장"}
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
                  <div className="admin-member-fields">
                    <span>
                      <b>나이</b>
                      {userDetail(user.age)}
                    </span>
                    <span>
                      <b>지역</b>
                      {userDetail(user.residenceArea)}
                    </span>
                    <span>
                      <b>자격증</b>
                      {userDetail(user.examType)}
                    </span>
                    <span>
                      <b>준비기간</b>
                      {userDetail(user.prepDuration)}
                    </span>
                    <span>
                      <b>결제</b>
                      {dDayText(user.membershipEnd)}
                    </span>
                    <span>
                      <b>상태</b>
                      {user.isActive ? "활성" : "대기"}
                    </span>
                    <span>
                      <b>연락처</b>
                      {userDetail(user.phone, "없음")}
                    </span>
                  </div>
                  <button
                    className="admin-member-edit-button"
                    onClick={() => startEdit(user)}
                    type="button"
                  >
                    수정
                  </button>
                </>
              )}
            </article>
          );
        })}
      </div>

      <AdminPager meta={pageMeta} onPageChange={onPageChange} />
    </section>
  );
}
