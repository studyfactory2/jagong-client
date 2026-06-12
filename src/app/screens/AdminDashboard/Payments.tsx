import type { AdminUser, PageMeta, PaymentRecord } from "../../../lib/types";
import AdminPager from "./AdminPager";
import { dateText, money, userName } from "./admin.utils";

type PaymentsProps = {
  payments: PaymentRecord[];
  users: AdminUser[];
  pageMeta: PageMeta;
  onPageChange: (page: number) => void;
};

export default function Payments(props: PaymentsProps) {
  const { payments, users, pageMeta, onPageChange } = props;

  return (
    <section className="admin-card">
      <div className="admin-section-head">
        <h2>결제 내역</h2>
        <span>{pageMeta.total}건</span>
      </div>

      <div className="admin-table">
        {payments.map((payment) => (
          <div className="admin-row is-payment" key={payment.id}>
            <strong>{userName(users, payment.userId)}</strong>
            <span>{payment.planMonths}개월</span>
            <span>{payment.status}</span>
            <span>{money(payment.amount)}</span>
            <em>{dateText(payment.createdAt)}</em>

            <div className="admin-receipt-actions">
              {payment.receiptSignedUrl ? (
                <a href={payment.receiptSignedUrl} rel="noreferrer" target="_blank">
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
