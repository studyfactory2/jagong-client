import type { ConsultationRecord } from "../../../lib/types";
import { dateText } from "./admin.utils";

type ConsultationsProps = {
  consultations: ConsultationRecord[];
  onConfirm: (id: string) => void;
  onComplete: (id: string) => void;
};

export default function Consultations(props: ConsultationsProps) {
  const { consultations, onConfirm, onComplete } = props;

  return (
    <section className="admin-card">
      <h2>상담 예약</h2>
      <div className="admin-table">
        {consultations.map((item) => (
          <div className="admin-row is-action" key={item.id}>
            <strong>{item.name}</strong>
            <span>{item.phone}</span>
            <span>{item.consultType ?? "상담"}</span>
            <span>{item.status}</span>
            <em>
              {item.desiredDate ?? dateText(item.createdAt)} · {item.timeSlot ?? "시간 미정"}
            </em>
            <button onClick={() => onConfirm(item.id)} type="button">
              확정
            </button>
            <button onClick={() => onComplete(item.id)} type="button">
              완료
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
