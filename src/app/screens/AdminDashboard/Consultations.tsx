import type { ConsultationRecord, PageMeta } from "../../../lib/types";
import AdminPager from "./AdminPager";
import { dateText } from "./admin.utils";

type ConsultationsProps = {
  consultations: ConsultationRecord[];
  searchText: string;
  onSearchChange: (value: string) => void;
  onConfirm: (id: string) => void;
  onComplete: (id: string) => void;
  pageMeta: PageMeta;
  onPageChange: (page: number) => void;
};

export default function Consultations(props: ConsultationsProps) {
  const {
    consultations,
    searchText,
    onSearchChange,
    onConfirm,
    onComplete,
    pageMeta,
    onPageChange,
  } = props;

  return (
    <section className="admin-card">
      <div className="admin-section-head">
        <h2>상담 예약</h2>
        <span>{pageMeta.total}건</span>
      </div>

      <label className="admin-search">
        <span>상담 검색</span>
        <input
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="이름, 연락처, 자격증, 지역 검색"
        />
      </label>

      <div className="admin-table">
        {consultations.length === 0 && (
          <div className="admin-list-empty">상담 예약이 없습니다.</div>
        )}
        {consultations.map((item) => (
          <div className="admin-row is-action" key={item.id}>
            <strong>{item.name}</strong>
            <span>{item.phone}</span>
            <span>{item.consultType ?? "상담"}</span>
            <span>{item.status}</span>
            <em>
              {item.desiredDate ?? dateText(item.createdAt)} ·{" "}
              {item.timeSlot ?? "시간 미정"}
            </em>
            <button
              disabled={item.status !== "PENDING"}
              onClick={() => onConfirm(item.id)}
              type="button"
            >
              확정
            </button>
            <button
              disabled={item.status === "COMPLETED" || item.status === "CANCELLED"}
              onClick={() => onComplete(item.id)}
              type="button"
            >
              완료
            </button>
          </div>
        ))}
      </div>
      <AdminPager meta={pageMeta} onPageChange={onPageChange} />
    </section>
  );
}
