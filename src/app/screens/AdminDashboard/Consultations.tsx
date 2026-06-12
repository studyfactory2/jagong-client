import type { ConsultationRecord, PageMeta } from "../../../lib/types";
import AdminPager from "./AdminPager";
import { dateText } from "./admin.utils";

type ConsultationsProps = {
  consultations: ConsultationRecord[];
  onConfirm: (id: string) => void;
  onComplete: (id: string) => void;
  pageMeta: PageMeta;
  onPageChange: (page: number) => void;
};

export default function Consultations(props: ConsultationsProps) {
  const { consultations, onConfirm, onComplete, pageMeta, onPageChange } = props;

  return (
    <section className="admin-card">
      <div className="admin-section-head">
        <h2>상담 예약</h2>
        <span>{pageMeta.total}건</span>
      </div>
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
      <AdminPager meta={pageMeta} onPageChange={onPageChange} />
    </section>
  );
}
