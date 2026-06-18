import type { AdminUser, PageMeta, PaymentRecord } from "../../../lib/types";
import AdminPager from "./AdminPager";
import { dateText, money, userName } from "./admin.utils";

type PaymentsProps = {
  payments: PaymentRecord[];
  users: AdminUser[];
  searchText: string;
  onSearchChange: (value: string) => void;
  pageMeta: PageMeta;
  onPageChange: (page: number) => void;
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "결제대기",
  PAID: "결제완료",
  FAILED: "실패",
  CANCELLED: "취소",
  REFUNDED: "환불완료",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CARD: "카드",
  TRANSFER: "계좌이체",
};

export default function Payments(props: PaymentsProps) {
  const { payments, users, searchText, onSearchChange, pageMeta, onPageChange } = props;

  return (
    <section className="admin-card">
      <div className="admin-section-head">
        <h2>결제 내역</h2>
        <span>{pageMeta.total}건</span>
      </div>

      <label className="admin-search">
        <span>결제 검색</span>
        <input
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="회원명, 연락처, 입금자명, 메모 검색"
        />
      </label>

      <div className="admin-table">
        {payments.length === 0 && (
          <div className="admin-list-empty">결제 내역이 없습니다.</div>
        )}
        {payments.map((payment) => (
          <div className="admin-row is-payment" key={payment.id}>
            <strong>{userName(users, payment.userId)}</strong>
            <span>{payment.planMonths}개월 · {PAYMENT_METHOD_LABEL[payment.method ?? ""] ?? "기타"}</span>
            <span>{PAYMENT_STATUS_LABEL[payment.status] ?? payment.status}</span>
            <span>
              {money(payment.amount)}
              {payment.status === "REFUNDED" && payment.refundAmount != null && (
                <small>환불 {money(payment.refundAmount)}</small>
              )}
            </span>
            <em>{dateText(payment.createdAt)}</em>

            <div className="admin-receipt-actions">
              {payment.receiptSignedUrl ? (
                <a
                  href={payment.receiptSignedUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  영수증 보기
                </a>
              ) : (
                <span>영수증 없음</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <AdminPager meta={pageMeta} onPageChange={onPageChange} />
    </section>
  );
}
