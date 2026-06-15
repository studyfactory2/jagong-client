import type { AdminUser, LeaveRecord, PageMeta } from "../../../lib/types";
import AdminPager from "./AdminPager";
import { dateText, userName } from "./admin.utils";

type LeavesProps = {
  leaves: LeaveRecord[];
  users: AdminUser[];
  searchText: string;
  onSearchChange: (value: string) => void;
  onAction: (id: string, action: "approve" | "reject") => void;
  pageMeta: PageMeta;
  onPageChange: (page: number) => void;
};

export default function Leaves({
  leaves,
  users,
  searchText,
  onSearchChange,
  onAction,
  pageMeta,
  onPageChange,
}: LeavesProps) {
  return (
    <section className="admin-card">
      <div className="admin-section-head">
        <h2>휴가 신청</h2>
        <span>{pageMeta.total}건</span>
      </div>

      <label className="admin-search">
        <span>휴가 검색</span>
        <input
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="회원명, 연락처, 자격증, 사유 검색"
        />
      </label>

      <div className="admin-table">
        {leaves.length === 0 && (
          <div className="admin-list-empty">휴가 신청이 없습니다.</div>
        )}
        {leaves.map((leave) => (
          <div className="admin-row is-action" key={leave.id}>
            <strong>{leave.user?.name ?? userName(users, leave.userId)}</strong>
            <span>{leave.leaveType}</span>
            <span>{leave.status}</span>
            <span>{dateText(leave.date)}</span>
            <em>{leave.reason ?? "사유 없음"}</em>
            <button
              disabled={leave.status !== "PENDING"}
              onClick={() => onAction(leave.id, "approve")}
              type="button"
            >
              승인
            </button>
            <button
              disabled={leave.status !== "PENDING"}
              onClick={() => onAction(leave.id, "reject")}
              type="button"
            >
              반려
            </button>
          </div>
        ))}
      </div>
      <AdminPager meta={pageMeta} onPageChange={onPageChange} />
    </section>
  );
}
