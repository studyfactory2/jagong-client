import type { AdminUser, CamSessionRecord } from "../../../lib/types";
import { dateText, userName } from "./admin.utils";

type CameraProps = {
  camSessions: CamSessionRecord[];
  users: AdminUser[];
};

export default function Camera({ camSessions, users }: CameraProps) {
  return (
    <section className="admin-card">
      <h2>캠 세션</h2>
      <div className="admin-table">
        {camSessions.map((cam) => (
          <div className="admin-row" key={cam.id}>
            <strong>{cam.user?.name ?? userName(users, cam.userId)}</strong>
            <span>{cam.slot}교시</span>
            <span>{cam.leftAt ? "퇴장" : "입장중"}</span>
            <span>{dateText(cam.joinedAt ?? cam.date)}</span>
            <em>{cam.leftAt ? dateText(cam.leftAt) : "진행 중"}</em>
          </div>
        ))}
      </div>
    </section>
  );
}
