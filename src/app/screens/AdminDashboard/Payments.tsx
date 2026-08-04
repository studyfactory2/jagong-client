import { useRef, useState } from "react";
import type {
  AdminUser,
  ManualRefundRequest,
  PageMeta,
  PaymentRecord,
  RefundPreview,
} from "../../../lib/types";
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
  focusedMember: { id: string; name: string } | null;
  onClearFocusedMember: () => void;
  onReturnToAttendance: () => void;
};

type RefundDraft = {
  externalReference: string;
  evidence: string;
  memo: string;
};

const EMPTY_REFUND_DRAFT: RefundDraft = {
  externalReference: "",
  evidence: "",
  memo: "",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "결제대기",
  PAID: "결제완료",
  FAILED: "실패",
  CANCELLED: "취소",
  SUPERSEDED: "링크교체",
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

function standardPaymentAmount(payment: PaymentRecord) {
  return payment.amount + Math.max(0, payment.discountAmount ?? 0);
}

function manualRefundRequest(draft: RefundDraft): ManualRefundRequest {
  const externalReference = draft.externalReference.trim();
  const evidence = draft.evidence.trim();
  const memo = draft.memo.trim();

  return {
    ...(externalReference ? { externalReference } : {}),
    ...(evidence ? { evidence } : {}),
    ...(memo ? { memo } : {}),
  };
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
    focusedMember,
    onClearFocusedMember,
    onReturnToAttendance,
  } = props;
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [refundPreview, setRefundPreview] = useState<
    Record<string, RefundPreview>
  >({});
  const [refundDrafts, setRefundDrafts] = useState<Record<string, RefundDraft>>(
    {},
  );
  const [refundBusyId, setRefundBusyId] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<{
    paymentId: string;
    message: string;
  } | null>(null);
  const refundActionLock = useRef<string | null>(null);
  const selectedPayment =
    payments.find((payment) => payment.id === selectedPaymentId) ??
    payments[0] ??
    null;

  function selectPayment(paymentId: string) {
    setSelectedPaymentId(paymentId);
    setRefundError(null);
  }

  function updateRefundDraft(
    paymentId: string,
    field: keyof RefundDraft,
    value: string,
  ) {
    setRefundDrafts((current) => ({
      ...current,
      [paymentId]: {
        ...(current[paymentId] ?? EMPTY_REFUND_DRAFT),
        [field]: value,
      },
    }));
    setRefundError(null);
  }

  async function showRefundPreview(paymentId: string) {
    if (refundActionLock.current) return;
    refundActionLock.current = paymentId;
    setRefundError(null);
    setRefundBusyId(paymentId);
    try {
      const preview = await previewRefund(paymentId);
      setRefundPreview((current) => ({ ...current, [paymentId]: preview }));
    } catch (error) {
      setRefundError({
        paymentId,
        message:
          error instanceof Error
            ? error.message
            : "환불 예상금액을 불러오지 못했습니다.",
      });
    } finally {
      if (refundActionLock.current === paymentId) {
        refundActionLock.current = null;
        setRefundBusyId(null);
      }
    }
  }

  async function recordRefund(payment: PaymentRecord) {
    const preview = refundPreview[payment.id];
    if (!preview || refundActionLock.current) return;

    const input = manualRefundRequest(
      refundDrafts[payment.id] ?? EMPTY_REFUND_DRAFT,
    );
    if (!input.externalReference && !input.evidence) {
      setRefundError({
        paymentId: payment.id,
        message: "외부 환불 참조번호 또는 환불 증빙을 입력해주세요.",
      });
      return;
    }

    const refundText = money(preview.refundAmount);
    const confirmed = window.confirm(
      [
        "이미 포트원/은행에서 실제 환불을 완료하셨나요?",
        "",
        `현재 예상 환불액은 ${refundText}입니다.`,
        "기록 시점에 서버가 이용일수를 다시 계산해 최종 금액을 저장합니다.",
        "이 작업은 실제 송금이나 카드취소를 실행하지 않습니다.",
      ].join("\n"),
    );
    if (!confirmed) return;

    refundActionLock.current = payment.id;
    setRefundError(null);
    setRefundBusyId(payment.id);
    try {
      await recordManualRefund(payment.id, input);
      setRefundPreview((current) => {
        const next = { ...current };
        delete next[payment.id];
        return next;
      });
      setRefundDrafts((current) => {
        const next = { ...current };
        delete next[payment.id];
        return next;
      });
      await onRefundRecorded();
    } catch (error) {
      try {
        await onRefundRecorded();
      } catch {
        // Preserve the original refund error when the reconciliation reload fails.
      }
      setRefundError({
        paymentId: payment.id,
        message:
          error instanceof Error
            ? error.message
            : "환불 완료 기록에 실패했습니다.",
      });
    } finally {
      if (refundActionLock.current === payment.id) {
        refundActionLock.current = null;
        setRefundBusyId(null);
      }
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
  const refundActionBusy = refundBusyId !== null;
  const selectedRefundDraft = selectedPayment
    ? (refundDrafts[selectedPayment.id] ?? EMPTY_REFUND_DRAFT)
    : EMPTY_REFUND_DRAFT;
  const selectedRefundReady = Boolean(
    selectedRefundDraft.externalReference.trim() ||
    selectedRefundDraft.evidence.trim(),
  );
  const selectedHasRefundRecord = selectedPayment?.status === "REFUNDED";

  return (
    <section className="admin-card admin-payment-directory">
      <div className="admin-payment-directory-head">
        <h2>결제 관리</h2>
        <span>{pageMeta.total}건</span>
      </div>

      {focusedMember && (
        <div className="admin-payment-member-context">
          <div>
            <span>출석부에서 선택한 회원</span>
            <strong>{focusedMember.name} 결제 내역</strong>
          </div>
          <div>
            <button onClick={onReturnToAttendance} type="button">
              출석 상세로
            </button>
            <button onClick={onClearFocusedMember} type="button">
              전체 결제 보기
            </button>
          </div>
        </div>
      )}

      <label className="admin-payment-directory-search">
        <span>결제 검색</span>
        <input
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="회원명, 연락처, 입금자명, 메모 검색"
        />
      </label>

      <div className="admin-payment-directory-workspace">
        <div className="admin-payment-directory-results">
          <div className="admin-payment-directory-list">
            <div
              aria-hidden="true"
              className="admin-payment-directory-list-head"
            >
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
                  onClick={() => selectPayment(payment.id)}
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

            <div className="admin-payment-detail-pricing">
              <dl>
                <div>
                  <dt>정상가</dt>
                  <dd>{money(standardPaymentAmount(selectedPayment))}</dd>
                </div>
                <div>
                  <dt>할인</dt>
                  <dd className="is-discount">
                    {selectedPayment.discountAmount > 0
                      ? `-${money(selectedPayment.discountAmount)}`
                      : money(0)}
                  </dd>
                </div>
                <div className="is-final">
                  <dt>최종 결제금액</dt>
                  <dd>{money(selectedPayment.amount)}</dd>
                </div>
              </dl>
              {selectedPayment.discountAmount > 0 && (
                <div className="admin-payment-detail-discount-reason">
                  <span>할인 사유</span>
                  <strong>{selectedPayment.discountReason ?? "-"}</strong>
                </div>
              )}
            </div>

            {selectedPayment.reviewRequiredAt && (
              <div className="admin-payment-review-warning">
                <strong>결제 확인 필요</strong>
                <span>
                  교체되거나 취소된 링크에서 결제가 확인되었습니다. 다른 결제
                  기록과 포트원을 함께 확인해주세요.
                </span>
              </div>
            )}

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
                <div className="admin-payment-refund-record-head">
                  <span>환불 기록</span>
                  <strong>
                    {selectedPayment.refundAmount != null
                      ? money(selectedPayment.refundAmount)
                      : "환불완료"}
                  </strong>
                </div>
                <dl className="admin-payment-refund-record-fields">
                  <div>
                    <dt>처리일</dt>
                    <dd>
                      {selectedPayment.refundedAt
                        ? dateText(selectedPayment.refundedAt)
                        : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt>처리 관리자</dt>
                    <dd>{selectedPayment.refundedBy?.name ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>환불 계산 대상액</dt>
                    <dd>{money(selectedPayment.amount)}</dd>
                  </div>
                  <div>
                    <dt>월 차감 기준</dt>
                    <dd>{money(selectedPayment.refundMonthlyBase)}</dd>
                  </div>
                  <div>
                    <dt>이용일수</dt>
                    <dd>
                      {selectedPayment.refundUsedDays != null
                        ? `${selectedPayment.refundUsedDays}일`
                        : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt>이용 차감액</dt>
                    <dd>
                      {selectedPayment.refundCharge != null
                        ? money(selectedPayment.refundCharge)
                        : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt>외부 참조번호</dt>
                    <dd>{selectedPayment.refundExternalReference ?? "-"}</dd>
                  </div>
                </dl>
                {selectedPayment.refundEvidence && (
                  <div className="admin-payment-refund-record-note">
                    <span>환불 증빙</span>
                    <p>{selectedPayment.refundEvidence}</p>
                  </div>
                )}
                {selectedPayment.refundMemo && (
                  <div className="admin-payment-refund-record-note">
                    <span>환불 메모</span>
                    <p>{selectedPayment.refundMemo}</p>
                  </div>
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
                      <dt>환불 계산 대상액</dt>
                      <dd>{money(selectedPreview.amount)}</dd>
                    </div>
                    <div>
                      <dt>월 차감 기준</dt>
                      <dd>{money(selectedPayment.refundMonthlyBase)}</dd>
                    </div>
                    <div>
                      <dt>이용일수</dt>
                      <dd>{selectedPreview.refundUsedDays}일</dd>
                    </div>
                    <div>
                      <dt>이용 차감액</dt>
                      <dd>{money(selectedPreview.refundCharge)}</dd>
                    </div>
                    <div className="is-result">
                      <dt>예상 환불액</dt>
                      <dd>{money(selectedPreview.refundAmount)}</dd>
                    </div>
                  </dl>
                )}

                <div className="admin-payment-refund-form">
                  <label>
                    <span>
                      외부 환불 참조번호 <small>참조번호 또는 증빙 필수</small>
                    </span>
                    <input
                      autoComplete="off"
                      maxLength={200}
                      onChange={(event) =>
                        updateRefundDraft(
                          selectedPayment.id,
                          "externalReference",
                          event.target.value,
                        )
                      }
                      placeholder="예: 포트원 취소번호, 은행 거래번호"
                      value={selectedRefundDraft.externalReference}
                    />
                  </label>
                  <label>
                    <span>
                      환불 증빙 <small>참조번호 또는 증빙 필수</small>
                    </span>
                    <textarea
                      maxLength={500}
                      onChange={(event) =>
                        updateRefundDraft(
                          selectedPayment.id,
                          "evidence",
                          event.target.value,
                        )
                      }
                      placeholder="실제 환불 처리 내역을 입력하세요."
                      value={selectedRefundDraft.evidence}
                    />
                  </label>
                  <label>
                    <span>
                      환불 메모 <small>선택</small>
                    </span>
                    <textarea
                      maxLength={500}
                      onChange={(event) =>
                        updateRefundDraft(
                          selectedPayment.id,
                          "memo",
                          event.target.value,
                        )
                      }
                      placeholder="관리자 확인사항이 있다면 입력하세요."
                      value={selectedRefundDraft.memo}
                    />
                  </label>
                </div>

                {refundError?.paymentId === selectedPayment.id && (
                  <p className="admin-inline-error" role="alert">
                    {refundError.message}
                  </p>
                )}

                <div className="admin-payment-refund-actions">
                  <button
                    disabled={refundActionBusy}
                    onClick={() => void showRefundPreview(selectedPayment.id)}
                    type="button"
                  >
                    {selectedRefundBusy ? "처리 중..." : "환불 금액 계산"}
                  </button>
                  <button
                    disabled={
                      refundActionBusy ||
                      !selectedPreview ||
                      !selectedRefundReady
                    }
                    onClick={() => void recordRefund(selectedPayment)}
                    type="button"
                  >
                    {selectedRefundBusy ? "처리 중..." : "환불 완료 기록"}
                  </button>
                </div>

                <small>
                  실제 송금이나 카드 취소는 포트원 또는 은행에서 먼저 처리해야
                  합니다. 기록 시 서버가 환불액을 다시 계산합니다.
                </small>
              </div>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}
