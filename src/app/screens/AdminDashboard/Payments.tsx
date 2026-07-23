import { useState } from "react";
import type { AdminUser, PageMeta, PaymentRecord } from "../../../lib/types";
import {
  previewRefund,
  recordManualRefund,
} from "../../services/membership.service";
import AdminPager from "./AdminPager";
import {
  dateOnlyText,
  dateText,
  membershipEndText,
  money,
  userName,
} from "./admin.utils";

type PaymentsProps = {
  payments: PaymentRecord[];
  users: AdminUser[];
  searchText: string;
  onSearchChange: (value: string) => void;
  pageMeta: PageMeta;
  onPageChange: (page: number) => void;
  onRefundRecorded: () => Promise<void> | void;
};

type RefundPreviewState = {
  amount: number;
  refundAmount: number;
  refundCharge: number;
  refundUsedDays: number;
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
  EASY_PAY: "간편결제",
  TRANSFER: "계좌이체",
};

function paymentOwner(payment: PaymentRecord, users: AdminUser[]) {
  if (payment.user?.name) return payment.user.name;
  if (payment.userId) return userName(users, payment.userId);
  return payment.consultation?.name ?? "상담 결제";
}

function paymentPhone(payment: PaymentRecord, users: AdminUser[]) {
  if (payment.user?.phone) return payment.user.phone;
  if (payment.consultation?.phone) return payment.consultation.phone;
  if (!payment.userId) return "";
  return users.find(
    (user) => user.id === payment.userId || user.userId === payment.userId,
  )?.phone;
}

function paymentMethod(payment: PaymentRecord) {
  return PAYMENT_METHOD_LABEL[payment.method ?? ""] ?? "기타 결제";
}

function paymentStatus(payment: PaymentRecord) {
  return PAYMENT_STATUS_LABEL[payment.status] ?? payment.status;
}

function paymentStatusTone(status: string) {
  return `is-${status.toLowerCase()}`;
}

function paymentDate(payment: PaymentRecord) {
  return dateOnlyText(payment.paidAt ?? payment.createdAt);
}

function paymentPeriod(payment: PaymentRecord) {
  if (!payment.periodStart || !payment.periodEnd) return "이용기간 미정";
  return `${dateOnlyText(payment.periodStart)} ~ ${membershipEndText(payment.periodEnd)}`;
}

export default function Payments(props: PaymentsProps) {
  const {
    payments,
    users,
    searchText,
    onSearchChange,
    pageMeta,
    onPageChange,
    onRefundRecorded,
  } = props;
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [refundPreview, setRefundPreview] = useState<
    Record<string, RefundPreviewState>
  >({});
  const [refundBusyId, setRefundBusyId] = useState<string | null>(null);
  const [refundError, setRefundError] = useState("");
  const selectedPayment =
    payments.find((payment) => payment.id === selectedPaymentId) ??
    payments[0] ??
    null;

  async function showRefundPreview(paymentId: string) {
    setRefundError("");
    setRefundBusyId(paymentId);
    try {
      const preview = await previewRefund(paymentId);
      setRefundPreview((current) => ({ ...current, [paymentId]: preview }));
    } catch (error) {
      setRefundError(
        error instanceof Error
          ? error.message
          : "환불 예상금액을 불러오지 못했습니다.",
      );
    } finally {
      setRefundBusyId(null);
    }
  }

  async function recordRefund(payment: PaymentRecord) {
    const preview = refundPreview[payment.id];
    if (!preview) return;

    const refundText = money(preview.refundAmount);
    const confirmed = window.confirm(
      [
        "이미 포트원/은행에서 실제 환불을 완료하셨나요?",
        "",
        `앱에는 ${refundText} 환불 완료로 기록됩니다.`,
        "이 작업은 실제 송금이나 카드취소를 실행하지 않습니다.",
      ].join("\n"),
    );
    if (!confirmed) return;

    setRefundError("");
    setRefundBusyId(payment.id);
    try {
      await recordManualRefund(payment.id);
      setRefundPreview((current) => {
        const next = { ...current };
        delete next[payment.id];
        return next;
      });
      await onRefundRecorded();
    } catch (error) {
      setRefundError(
        error instanceof Error
          ? error.message
          : "환불 완료 기록에 실패했습니다.",
      );
    } finally {
      setRefundBusyId(null);
    }
  }

  const selectedOwner = selectedPayment
    ? paymentOwner(selectedPayment, users)
    : "";
  const selectedPhone = selectedPayment
    ? paymentPhone(selectedPayment, users)
    : "";
  const selectedPreview = selectedPayment
    ? refundPreview[selectedPayment.id]
    : undefined;
  const selectedRefundBusy = selectedPayment
    ? refundBusyId === selectedPayment.id
    : false;
  const selectedHasRefundRecord = Boolean(
    selectedPayment?.status === "REFUNDED" &&
      (selectedPayment.refundAmount != null || selectedPayment.refundedAt),
  );

  return (
    <section className="admin-card admin-payment-directory">
      <div className="admin-payment-directory-head">
        <h2>결제 관리</h2>
        <span>{pageMeta.total}건</span>
      </div>

      <label className="admin-payment-directory-search">
        <span>결제 검색</span>
        <input
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="회원명, 연락처, 입금자명, 메모 검색"
        />
      </label>

      {refundError && <p className="admin-inline-error">{refundError}</p>}

      <div className="admin-payment-directory-workspace">
        <div className="admin-payment-directory-results">
          <div className="admin-payment-directory-list">
            <div aria-hidden="true" className="admin-payment-directory-list-head">
              <span>결제일</span>
              <span>회원</span>
              <span>이용권</span>
              <span>금액</span>
              <span>상태</span>
              <span />
            </div>

            {payments.length === 0 && (
              <div className="admin-payment-directory-empty">
                결제 내역이 없습니다.
              </div>
            )}

            {payments.map((payment) => {
              const owner = paymentOwner(payment, users);
              return (
                <button
                  aria-pressed={selectedPayment?.id === payment.id}
                  className={`admin-payment-directory-row${selectedPayment?.id === payment.id ? " is-selected" : ""}`}
                  key={payment.id}
                  onClick={() => setSelectedPaymentId(payment.id)}
                  type="button"
                >
                  <span className="admin-payment-directory-date">
                    {paymentDate(payment)}
                  </span>
                  <span className="admin-payment-directory-person">
                    <span
                      aria-hidden="true"
                      className="admin-payment-directory-avatar"
                    >
                      {owner.slice(0, 1)}
                    </span>
                    <span>
                      <strong>{owner}</strong>
                      <small>
                        {paymentDate(payment)} · {payment.planMonths}개월 ·{" "}
                        {money(payment.amount)}
                      </small>
                    </span>
                  </span>
                  <span className="admin-payment-directory-plan">
                    {payment.planMonths}개월
                  </span>
                  <strong className="admin-payment-directory-amount">
                    {money(payment.amount)}
                  </strong>
                  <em
                    className={`admin-payment-directory-status ${paymentStatusTone(payment.status)}`}
                  >
                    {paymentStatus(payment)}
                  </em>
                  <span
                    aria-hidden="true"
                    className="admin-payment-directory-chevron"
                  >
                    ›
                  </span>
                </button>
              );
            })}
          </div>

          <AdminPager meta={pageMeta} onPageChange={onPageChange} />
        </div>

        {selectedPayment && (
          <aside className="admin-payment-directory-detail">
            <div className="admin-payment-detail-head">
              <div>
                <span
                  aria-hidden="true"
                  className="admin-payment-directory-avatar"
                >
                  {selectedOwner.slice(0, 1)}
                </span>
                <div>
                  <strong>{selectedOwner}</strong>
                  <span>{selectedPhone || "연락처 없음"}</span>
                </div>
              </div>
              <em
                className={`admin-payment-directory-status ${paymentStatusTone(selectedPayment.status)}`}
              >
                {paymentStatus(selectedPayment)}
              </em>
            </div>

            <div className="admin-payment-detail-total">
              <span>결제 금액</span>
              <strong>{money(selectedPayment.amount)}</strong>
            </div>

            <dl className="admin-payment-directory-fields">
              <div>
                <dt>이용권</dt>
                <dd>{selectedPayment.planMonths}개월</dd>
              </div>
              <div>
                <dt>결제 방식</dt>
                <dd>{paymentMethod(selectedPayment)}</dd>
              </div>
              <div>
                <dt>확인일</dt>
                <dd>{paymentDate(selectedPayment)}</dd>
              </div>
              <div>
                <dt>이용기간</dt>
                <dd>{paymentPeriod(selectedPayment)}</dd>
              </div>
              <div>
                <dt>입금자명</dt>
                <dd>{selectedPayment.depositorName ?? "-"}</dd>
              </div>
              <div>
                <dt>결제 경로</dt>
                <dd>
                  {selectedPayment.consultationId ? "상담 결제" : "회원 결제"}
                </dd>
              </div>
            </dl>

            {selectedPayment.adminMemo && (
              <div className="admin-payment-detail-note">
                <span>관리자 메모</span>
                <p>{selectedPayment.adminMemo}</p>
              </div>
            )}

            <div className="admin-payment-receipt">
              <span>증빙 자료</span>
              {selectedPayment.receiptSignedUrl ? (
                <a
                  href={selectedPayment.receiptSignedUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  영수증 보기
                </a>
              ) : (
                <em>등록된 영수증이 없습니다.</em>
              )}
            </div>

            {selectedHasRefundRecord && (
              <div className="admin-payment-refund-record">
                <span>환불 기록</span>
                <strong>
                  {selectedPayment.refundAmount != null
                    ? money(selectedPayment.refundAmount)
                    : "환불완료"}
                </strong>
                {selectedPayment.refundedAt && (
                  <small>{dateText(selectedPayment.refundedAt)}</small>
                )}
              </div>
            )}

            {selectedPayment.status === "PAID" && (
              <div className="admin-payment-refund-panel">
                <div>
                  <strong>환불 관리</strong>
                  <span>실제 환불 완료 후 시스템 기록을 남깁니다.</span>
                </div>

                {selectedPreview && (
                  <dl className="admin-payment-refund-preview">
                    <div>
                      <dt>이용일</dt>
                      <dd>{selectedPreview.refundUsedDays}일</dd>
                    </div>
                    <div>
                      <dt>차감액</dt>
                      <dd>{money(selectedPreview.refundCharge)}</dd>
                    </div>
                    <div>
                      <dt>환불액</dt>
                      <dd>{money(selectedPreview.refundAmount)}</dd>
                    </div>
                  </dl>
                )}

                <div className="admin-payment-refund-actions">
                  <button
                    disabled={selectedRefundBusy}
                    onClick={() => void showRefundPreview(selectedPayment.id)}
                    type="button"
                  >
                    {selectedRefundBusy ? "계산 중..." : "환불 금액 계산"}
                  </button>
                  <button
                    disabled={selectedRefundBusy || !selectedPreview}
                    onClick={() => void recordRefund(selectedPayment)}
                    type="button"
                  >
                    환불 완료 기록
                  </button>
                </div>

                <small>
                  실제 송금이나 카드 취소는 포트원 또는 은행에서 처리합니다.
                </small>
              </div>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}
