import { useState } from "react";
import KeyboardArrowDownOutlinedIcon from "@mui/icons-material/KeyboardArrowDownOutlined";
import KeyboardArrowUpOutlinedIcon from "@mui/icons-material/KeyboardArrowUpOutlined";
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
  const [refundPreview, setRefundPreview] = useState<
    Record<string, RefundPreviewState>
  >({});
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(
    null,
  );
  const [refundBusyId, setRefundBusyId] = useState<string | null>(null);
  const [refundError, setRefundError] = useState("");

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

      {refundError && <p className="admin-inline-error">{refundError}</p>}

      <div className="admin-table">
        {payments.length === 0 && (
          <div className="admin-list-empty">결제 내역이 없습니다.</div>
        )}
        {payments.map((payment) => {
          const owner = payment.userId
            ? userName(users, payment.userId)
            : (payment.consultation?.name ?? "상담 결제");
          const paidDate = payment.paidAt ?? payment.createdAt;
          const period =
            payment.periodStart && payment.periodEnd
              ? `${dateOnlyText(payment.periodStart)} ~ ${membershipEndText(
                  payment.periodEnd,
                )}`
              : "이용기간 미정";
          const preview = refundPreview[payment.id];
          const canRecordRefund = payment.status === "PAID";
          const isRefundBusy = refundBusyId === payment.id;
          const isExpanded = expandedPaymentId === payment.id;
          const method =
            PAYMENT_METHOD_LABEL[payment.method ?? ""] ?? "기타 결제";
          const hasRefundRecord =
            payment.status === "REFUNDED" &&
            (payment.refundAmount != null || payment.refundedAt);

          return (
            <div
              className={`admin-row is-payment admin-payment-row${
                isExpanded ? " is-expanded" : ""
              }`}
              key={payment.id}
            >
              <strong className="admin-payment-owner">{owner}</strong>
              <span className="admin-payment-amount">
                {money(payment.amount)}
              </span>
              <span className="admin-payment-status">
                <span className="admin-payment-status-chip">
                  {PAYMENT_STATUS_LABEL[payment.status] ?? payment.status}
                </span>
              </span>
              <button
                aria-expanded={isExpanded}
                className="admin-payment-toggle"
                onClick={() =>
                  setExpandedPaymentId((current) =>
                    current === payment.id ? null : payment.id,
                  )
                }
                type="button"
              >
                {isExpanded ? "닫기" : "상세"}
                {isExpanded ? (
                  <KeyboardArrowUpOutlinedIcon />
                ) : (
                  <KeyboardArrowDownOutlinedIcon />
                )}
              </button>

              {isExpanded && (
                <div className="admin-payment-details">
                  <dl className="admin-payment-detail-meta">
                    <div>
                      <dt>이용권</dt>
                      <dd>
                        {payment.planMonths}개월 · {method}
                      </dd>
                    </div>
                    <div>
                      <dt>확인일</dt>
                      <dd>{dateOnlyText(paidDate)}</dd>
                    </div>
                    <div>
                      <dt>이용기간</dt>
                      <dd>{period}</dd>
                    </div>
                    {payment.depositorName && (
                      <div>
                        <dt>입금자명</dt>
                        <dd>{payment.depositorName}</dd>
                      </div>
                    )}
                    {payment.adminMemo && (
                      <div>
                        <dt>메모</dt>
                        <dd>{payment.adminMemo}</dd>
                      </div>
                    )}
                    {payment.consultationId && (
                      <div>
                        <dt>상담 결제</dt>
                        <dd>예</dd>
                      </div>
                    )}
                    {hasRefundRecord && (
                      <div>
                        <dt>환불 기록</dt>
                        <dd>
                          {payment.refundAmount != null
                            ? money(payment.refundAmount)
                            : "환불완료"}
                          {payment.refundedAt && (
                            <small>{dateText(payment.refundedAt)}</small>
                          )}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="admin-payment-detail-actions">
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

                    {canRecordRefund && (
                      <div className="admin-refund-actions">
                        <strong className="admin-refund-title">
                          환불 관리
                        </strong>
                        {preview && (
                          <div className="admin-refund-preview">
                            <span>이용 {preview.refundUsedDays}일</span>
                            <span>차감 {money(preview.refundCharge)}</span>
                            <strong>환불 {money(preview.refundAmount)}</strong>
                          </div>
                        )}
                        <button
                          disabled={isRefundBusy}
                          onClick={() => void showRefundPreview(payment.id)}
                          type="button"
                        >
                          {isRefundBusy ? "계산 중..." : "환불 계산"}
                        </button>
                        <button
                          disabled={isRefundBusy || !preview}
                          onClick={() => void recordRefund(payment)}
                          type="button"
                        >
                          환불 완료 기록
                        </button>
                        <small>
                          실제 환불은 포트원/은행에서 완료 후 기록하세요.
                        </small>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <AdminPager meta={pageMeta} onPageChange={onPageChange} />
    </section>
  );
}
