import type { AdminUser, LeaveRecord, PageMeta } from "../../../lib/types";
import AdminPager from "./AdminPager";
import { dateText, userName } from "./admin.utils";

type LeavesProps = {
  leaves: LeaveRecord[];
  users: AdminUser[];
  onAction: (id: string, action: "approve" | "reject") => void;
  pageMeta: PageMeta;
  onPageChange: (page: number) => void;
};

export default function Leaves({ leaves, users, onAction, pageMeta, onPageChange }: LeavesProps) {
  return (
    <section className="admin-card">
      <div className="admin-section-head">
        <h2>휴가 신청</h2>
        <span>{pageMeta.total}건</span>
      </div>
      <div className="admin-table">
        {leaves.map((leave) => (
          <div className="admin-row is-action" key={leave.id}>
            <strong>{leave.user?.name ?? userName(users, leave.userId)}</strong>
            <span>{leave.leaveType}</span>
            <span>{leave.status}</span>
            <span>{dateText(leave.date)}</span>
            <em>{leave.reason ?? "사유 없음"}</em>
            <button onClick={() => onAction(leave.id, "approve")} type="button">
              승인
            </button>
            <button onClick={() => onAction(leave.id, "reject")} type="button">
              반려
            </button>
          </div>
        ))}
      </div>
      <AdminPager meta={pageMeta} onPageChange={onPageChange} />
    </section>
  );
}
