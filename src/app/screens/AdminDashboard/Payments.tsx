import type { AdminUser, PaymentRecord } from "../../../lib/types";
import { dateText, money, userName } from "./admin.utils";

type PaymentsProps = {
  payments: PaymentRecord[];
  users: AdminUser[];
};

export default function Payments({ payments, users }: PaymentsProps) {
  return (
    <section className="admin-card">
      <h2>결제 내역</h2>
      <div className="admin-table">
        {payments.map((payment) => (
          <div className="admin-row" key={payment.id}>
            <strong>{userName(users, payment.userId)}</strong>
            <span>{payment.planMonths}개월</span>
            <span>{payment.status}</span>
            <span>{money(payment.amount)}</span>
            <em>{dateText(payment.createdAt)}</em>
          </div>
        ))}
      </div>
    </section>
  );
}
