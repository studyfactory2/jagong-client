import { useEffect, useState } from "react";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import PersonSearchOutlinedIcon from "@mui/icons-material/PersonSearchOutlined";
import type {
  AdminUser,
  Branch,
  MemberStatus,
  PageMeta,
} from "../../../lib/types";
import AdminPager from "./AdminPager";
import { dDayText, userDetail } from "./admin.utils";

export type MemberStatusFilter = "ALL" | MemberStatus;

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
  memberStatusFilter: MemberStatusFilter;
  memberStatusBusy: boolean;
  onSearchChange: (value: string) => void;
  onMemberStatusFilterChange: (value: MemberStatusFilter) => void;
  onMemberStatusChange: (
    userId: string,
    memberStatus: MemberStatus,
  ) => Promise<boolean>;
  onUserUpdate: (userId: string, input: Partial<AdminUser>) => Promise<void>;
  pageMeta: PageMeta;
  onPageChange: (page: number) => void;
};

const MEMBER_STATUS_FILTERS: Array<{
  value: MemberStatusFilter;
  label: string;
}> = [
  { value: "ALL", label: "전체" },
  { value: "ACTIVE", label: "접근 허용" },
  { value: "BLOCKED", label: "이용 제한" },
];

function branchLabel(branches: Branch[], branchId?: string) {
  if (!branchId) return "지점 없음";
  const branch = branches.find((item) => item.id === branchId);
  return branch ? branch.name : "알 수 없는 지점";
}

function memberEditForm(user: AdminUser): MemberEditForm {
  return {
    phone: user.phone ?? "",
    residenceArea: user.residenceArea ?? "",
    age: user.age ? String(user.age) : "",
    examType: user.examType ?? "",
    prepDuration: user.prepDuration ?? "",
    notes: user.notes ?? "",
    isActive: Boolean(user.isActive),
  };
}

function memberAccessStatus(user: AdminUser): MemberStatus {
  return user.memberStatus ?? "ACTIVE";
}

function MemberStatusBadges({ user }: { user: AdminUser }) {
  const accessStatus = memberAccessStatus(user);
  const accessLabel = accessStatus === "BLOCKED" ? "이용 제한" : "접근 허용";
  const registrationLabel = user.isActive ? "등록 활성" : "등록 대기";

  return (
    <span
      aria-label={`접근 상태 ${accessLabel}, 등록 상태 ${registrationLabel}`}
      className="admin-member-directory-statuses"
    >
      <em
        className={
          accessStatus === "BLOCKED"
            ? "is-access-blocked"
            : "is-access-active"
        }
      >
        {accessLabel}
      </em>
      <em
        className={
          user.isActive
            ? "is-registration-active"
            : "is-registration-pending"
        }
      >
        {registrationLabel}
      </em>
    </span>
  );
}

export default function Members({
  users,
  branches,
  searchText,
  memberStatusFilter,
  memberStatusBusy,
  onSearchChange,
  onMemberStatusFilterChange,
  onMemberStatusChange,
  onUserUpdate,
  pageMeta,
  onPageChange,
}: MembersProps) {
  const [selectedId, setSelectedId] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState<MemberEditForm | null>(null);
  const [savingId, setSavingId] = useState("");
  const [statusChange, setStatusChange] = useState<{
    userId: string;
    memberName: string;
    target: MemberStatus;
  } | null>(null);
  const statusChanging = Boolean(statusChange) || memberStatusBusy;
  const members = users.filter((user) => user.role === "MEMBER");
  const selectedUser =
    members.find((user) => user.id === selectedId) ?? null;
  const detailVisible = detailOpen && Boolean(selectedUser);

  useEffect(() => {
    if (!detailVisible) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setDetailOpen(false);
      setSelectedId("");
      setEditingId("");
      setEditForm(null);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [detailVisible]);

  function resetSelection() {
    setDetailOpen(false);
    setSelectedId("");
    setEditingId("");
    setEditForm(null);
  }

  function selectMember(user: AdminUser) {
    setSelectedId(user.id);
    setDetailOpen(true);
    setEditingId("");
    setEditForm(null);
  }

  function startEdit(user: AdminUser) {
    setEditingId(user.id);
    setEditForm(memberEditForm(user));
  }

  function updateEdit(field: keyof MemberEditForm, value: string | boolean) {
    setEditForm((current) =>
      current ? { ...current, [field]: value } : current,
    );
  }

  async function saveEdit(userId: string) {
    if (!editForm || savingId || statusChanging) return;
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

  function changeSearch(value: string) {
    resetSelection();
    onSearchChange(value);
  }

  function changeStatusFilter(value: MemberStatusFilter) {
    resetSelection();
    onMemberStatusFilterChange(value);
  }

  async function changeMemberStatus(user: AdminUser) {
    if (statusChanging) return;
    const target: MemberStatus =
      memberAccessStatus(user) === "BLOCKED" ? "ACTIVE" : "BLOCKED";
    const confirmed = window.confirm(
      target === "BLOCKED"
        ? `${user.name} 회원의 이용을 제한할까요?\n\n회원은 즉시 로그아웃되며 로그인, 학습, 카메라 및 실시간 연결 이용이 중지됩니다.\n관리자가 다시 허용하기 전까지 로그인할 수 없습니다.`
        : `${user.name} 회원의 접근을 다시 허용할까요?\n\n등록 활성 상태와 이용권 조건은 별도로 유지됩니다.\n해당 조건을 충족하면 회원이 다시 로그인할 수 있습니다.`,
    );
    if (!confirmed) return;

    setStatusChange({ userId: user.id, memberName: user.name, target });
    try {
      const changed = await onMemberStatusChange(user.id, target);
      if (
        changed &&
        memberStatusFilter !== "ALL" &&
        memberStatusFilter !== target
      ) {
        resetSelection();
      }
    } finally {
      setStatusChange(null);
    }
  }

  function changePage(page: number) {
    if (statusChanging) return;
    resetSelection();
    onPageChange(page);
  }

  return (
    <section className="admin-card admin-member-directory">
      <div className="admin-member-directory-head">
        <div>
          <h2>회원 관리</h2>
          <p>회원 정보, 등록 상태와 접근 권한을 확인하고 관리합니다.</p>
        </div>
        <span>{pageMeta.total}명</span>
      </div>

      <div className="admin-member-directory-toolbar">
        <label className="admin-member-directory-search">
          <span>회원 검색</span>
          <input
            disabled={statusChanging}
            value={searchText}
            onChange={(event) => changeSearch(event.target.value)}
            placeholder="이름, 연락처, 자격증, 지역 검색"
          />
        </label>

        <div className="admin-member-directory-status-filter">
          <span>접근 상태</span>
          <div aria-label="회원 접근 상태 필터" role="group">
            {MEMBER_STATUS_FILTERS.map((filter) => (
              <button
                aria-pressed={memberStatusFilter === filter.value}
                className={
                  memberStatusFilter === filter.value ? "is-selected" : ""
                }
                disabled={statusChanging}
                key={filter.value}
                onClick={() => changeStatusFilter(filter.value)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <span
        aria-live="polite"
        className="admin-member-directory-status-announcement"
        role="status"
      >
        {statusChange
          ? `${statusChange.memberName} 회원의 ${
              statusChange.target === "BLOCKED" ? "이용 제한" : "접근 허용"
            }을 처리하고 있습니다.`
          : memberStatusBusy
            ? "회원 접근 상태 변경을 처리하고 있습니다."
            : ""}
      </span>

      <div className="admin-member-directory-workspace">
        <fieldset
          aria-busy={statusChanging}
          className={`admin-member-directory-results${
            statusChanging ? " is-status-changing" : ""
          }`}
          disabled={statusChanging}
        >
          <div className="admin-member-directory-list">
            <div
              className="admin-member-directory-list-head"
              aria-hidden="true"
            >
              <span>회원</span>
              <span>준비기간</span>
              <span>이용권</span>
              <span>접근 / 등록</span>
              <span />
            </div>

            {members.length === 0 ? (
              <div className="admin-member-directory-empty">
                조건에 맞는 회원이 없습니다.
              </div>
            ) : (
              members.map((user) => (
                <button
                  aria-pressed={selectedUser?.id === user.id}
                  className={`admin-member-directory-row${
                    selectedUser?.id === user.id ? " is-selected" : ""
                  }`}
                  key={user.id}
                  onClick={() => selectMember(user)}
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
                  <MemberStatusBadges user={user} />
                  <span
                    className="admin-member-directory-chevron"
                    aria-hidden="true"
                  >
                    ›
                  </span>
                </button>
              ))
            )}
          </div>

          <AdminPager
            meta={pageMeta}
            numbered
            onPageChange={changePage}
          />
        </fieldset>

        <div
          className={`admin-member-directory-detail-layer${
            detailVisible ? " is-open" : ""
          }`}
        >
          <button
            aria-label="회원 상세 닫기"
            className="admin-member-directory-backdrop"
            onClick={resetSelection}
            type="button"
          />

          <aside
            aria-label="선택 회원 상세"
            className="admin-member-directory-detail"
          >
            <span
              className="admin-member-directory-sheet-handle"
              aria-hidden="true"
            />

            {!selectedUser ? (
              <div className="admin-member-directory-placeholder">
                <PersonSearchOutlinedIcon />
                <strong>회원을 선택해 주세요</strong>
                <span>
                  목록에서 회원을 선택하면 상세 정보와 수정 메뉴가 표시됩니다.
                </span>
              </div>
            ) : (
              <>
                <header className="admin-member-directory-detail-head">
                  <div className="admin-member-directory-detail-identity">
                    <span
                      className="admin-member-directory-avatar"
                      aria-hidden="true"
                    >
                      {selectedUser.name.slice(0, 1)}
                    </span>
                    <div className="admin-member-directory-detail-copy">
                      <small>선택 회원</small>
                      <strong>{selectedUser.name}</strong>
                      <span>
                        {branchLabel(branches, selectedUser.branchId)}
                      </span>
                    </div>
                  </div>
                  <div className="admin-member-directory-detail-controls">
                    <MemberStatusBadges user={selectedUser} />
                    <button
                      aria-label="회원 상세 닫기"
                      onClick={resetSelection}
                      type="button"
                    >
                      <CloseOutlinedIcon />
                    </button>
                  </div>
                </header>

                <div className="admin-member-directory-detail-body">
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
                      <label className="admin-member-directory-edit-note">
                        메모
                        <textarea
                          value={editForm.notes}
                          onChange={(event) =>
                            updateEdit("notes", event.target.value)
                          }
                          placeholder="관리자 메모를 입력하세요."
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
                        등록 활성 상태
                      </label>
                    </div>
                  ) : (
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
                        <dt>이용권 만료</dt>
                        <dd>{dDayText(selectedUser.membershipEnd)}</dd>
                      </div>
                    </dl>
                  )}
                </div>

                <footer className="admin-member-directory-actions">
                  {editingId === selectedUser.id && editForm ? (
                    <>
                      <button
                        disabled={
                          savingId === selectedUser.id || statusChanging
                        }
                        onClick={() => saveEdit(selectedUser.id)}
                        type="button"
                      >
                        {savingId === selectedUser.id ? "저장중" : "변경 저장"}
                      </button>
                      <button
                        disabled={savingId === selectedUser.id}
                        onClick={() => {
                          setEditingId("");
                          setEditForm(null);
                        }}
                        type="button"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="admin-member-directory-edit-button"
                        disabled={statusChanging}
                        onClick={() => startEdit(selectedUser)}
                        type="button"
                      >
                        회원 정보 수정
                      </button>
                      <button
                        aria-busy={statusChange?.userId === selectedUser.id}
                        className={`admin-member-directory-access-button ${
                          memberAccessStatus(selectedUser) === "BLOCKED"
                            ? "is-allow"
                            : "is-block"
                        }`}
                        disabled={statusChanging}
                        onClick={() => void changeMemberStatus(selectedUser)}
                        type="button"
                      >
                        {statusChange?.userId === selectedUser.id
                          ? statusChange.target === "BLOCKED"
                            ? "이용 제한 처리 중..."
                            : "접근 허용 처리 중..."
                          : memberAccessStatus(selectedUser) === "BLOCKED"
                            ? "접근 다시 허용"
                            : "이용 제한"}
                      </button>
                    </>
                  )}
                </footer>
              </>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
