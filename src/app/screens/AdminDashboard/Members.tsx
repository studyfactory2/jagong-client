import type { AdminUser } from "../../../lib/types";
import { dateText } from "./admin.utils";

type MembersProps = {
  users: AdminUser[];
};

export default function Members({ users }: MembersProps) {
  return (
    <section className="admin-card">
      <h2>회원 목록</h2>
      <div className="admin-table">
        {users.map((user) => (
          <div className="admin-row" key={user.id}>
            <strong>{user.name}</strong>
            <span>{user.role}</span>
            <span>{user.phone ?? "연락처 없음"}</span>
            <span>{user.isActive ? "활성" : "대기/비활성"}</span>
            <em>
              {user.membershipEnd
                ? "만료 " + dateText(user.membershipEnd)
                : "이용권 없음"}
            </em>
          </div>
        ))}
      </div>
    </section>
  );
}
