import { useRef, useState } from "react";
import type {
  ConsultationCheckoutLinkResult,
  ConsultationRecord,
  PageMeta,
} from "../../../lib/types";
import AdminPager from "./AdminPager";
import {
  addDaysDateOnly,
  dateOnlyText,
  dateText,
  money,
  todayDateInputValue,
  toDateInputValue,
} from "./admin.utils";

type ConsultationsProps = {
  consultations: ConsultationRecord[];
  searchText: string;
  onSearchChange: (value: string) => void;
  onConfirm: (
    id: string,
    consultType?: string | null,
    meetingLink?: string,
  ) => void;
  onComplete: (id: string) => void;
  onCreateCheckout: (input: {
    consultationId: string;
    planMonths: number;
    startDate: string;
  }) => Promise<ConsultationCheckoutLinkResult>;
  onReplaceCheckout: (input: {
    consultationId: string;
    paymentId: string;
    planMonths: number;
    startDate: string;
  }) => Promise<ConsultationCheckoutLinkResult>;
  onPreparePreRegister: (id: string) => void;
  pageMeta: PageMeta;
  onPageChange: (page: number) => void;
};

const CONSULT_TYPE_LABEL: Record<string, string> = {
  PHONE: "전화상담",
  VIDEO: "화상상담",
  QUESTION: "문의",
  IMMEDIATE: "바로시작",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "대기",
  CONFIRMED: "확정",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

function consultationDate(item: ConsultationRecord) {
  return item.desiredDate
    ? dateOnlyText(item.desiredDate)
    : dateText(item.createdAt);
}

function consultationType(item: ConsultationRecord) {
  return CONSULT_TYPE_LABEL[item.consultType ?? ""] ?? "상담";
}

function consultationStatus(item: ConsultationRecord) {
  return STATUS_LABEL[item.status] ?? item.status;
}

function statusTone(status: string) {
  return `is-${status.toLowerCase()}`;
}

function checkoutExpired(value?: string | null): boolean {
  if (!value) return true;
  const expiresAt = new Date(value).getTime();
  return Number.isNaN(expiresAt) || expiresAt <= Date.now();
}

export default function Consultations(props: ConsultationsProps) {
  const {
    consultations,
    searchText,
    onSearchChange,
    onConfirm,
    onComplete,
    onCreateCheckout,
    onReplaceCheckout,
    onPreparePreRegister,
    pageMeta,
    onPageChange,
  } = props;
  const [selectedId, setSelectedId] = useState("");
  const [meetingLinks, setMeetingLinks] = useState<Record<string, string>>({});
  const [checkoutForms, setCheckoutForms] = useState<
    Record<string, { months: number; startDate: string }>
  >({});
  const [provisionalCheckouts, setProvisionalCheckouts] = useState<
    Record<string, ConsultationCheckoutLinkResult>
  >({});
  const [copiedId, setCopiedId] = useState("");
  const [replacementModeId, setReplacementModeId] = useState("");
  const [checkoutBusyId, setCheckoutBusyId] = useState("");
  const checkoutBusyRef = useRef("");
  const [checkoutErrors, setCheckoutErrors] = useState<Record<string, string>>(
    {},
  );
  const startMin = todayDateInputValue();
  const startMax = addDaysDateOnly(startMin, 30) ?? startMin;
  const selectedConsultation =
    consultations.find((item) => item.id === selectedId) ??
    consultations[0] ??
    null;

  function pendingPayment(id: string) {
    return consultations
      .find((item) => item.id === id)
      ?.payments?.find((payment) => payment.status === "PENDING");
  }

  function provisionalCheckout(id: string) {
    const provisional = provisionalCheckouts[id];
    if (!provisional) return undefined;
    const serverPayments =
      consultations.find((item) => item.id === id)?.payments ?? [];
    const serverPayment = serverPayments.find(
      (payment) => payment.id === provisional.paymentId,
    );
    if (serverPayment && serverPayment.status !== "PENDING") {
      return undefined;
    }
    const lifecycleConfirmed = Boolean(
      serverPayment &&
      (!provisional.checkoutExpiresAt ||
        serverPayment.checkoutExpiresAt === provisional.checkoutExpiresAt),
    );
    const provisionalIssuedAt = provisional.checkoutIssuedAt
      ? new Date(provisional.checkoutIssuedAt).getTime()
      : Number.NaN;
    const serverHasNewerCheckout =
      Number.isFinite(provisionalIssuedAt) &&
      serverPayments.some(
        (payment) =>
          payment.id !== provisional.paymentId &&
          new Date(payment.createdAt).getTime() >= provisionalIssuedAt,
      );
    return lifecycleConfirmed || serverHasNewerCheckout
      ? undefined
      : provisional;
  }

  function checkoutForm(id: string) {
    const pending = pendingPayment(id);
    const saved = checkoutForms[id];
    if (pending) {
      const storedStart = toDateInputValue(pending.periodStart);
      const pendingStart = storedStart || startMin;
      const replacementRequired = !storedStart || pendingStart < startMin;
      const replacing =
        replacementModeId === id || replacementRequired;
      if (saved && replacing) return saved;
      return {
        months: pending.planMonths,
        startDate: replacing && pendingStart < startMin ? startMin : pendingStart,
      };
    }

    return saved ?? { months: 1, startDate: startMin };
  }

  function updateCheckoutForm(
    id: string,
    patch: Partial<{ months: number; startDate: string }>,
  ) {
    setCheckoutForms((current) => ({
      ...current,
      [id]: { ...checkoutForm(id), ...patch },
    }));
  }

  function beginReplacement(id: string) {
    const pending = pendingPayment(id);
    if (!pending) return;
    const pendingStart = toDateInputValue(pending.periodStart) || startMin;
    setCheckoutForms((current) => ({
      ...current,
      [id]: {
        months: pending.planMonths,
        startDate: pendingStart < startMin ? startMin : pendingStart,
      },
    }));
    setCheckoutErrors((current) => ({ ...current, [id]: "" }));
    setReplacementModeId(id);
  }

  function cancelReplacement(id: string) {
    setCheckoutForms((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setCheckoutErrors((current) => ({ ...current, [id]: "" }));
    setReplacementModeId("");
  }

  async function createLink(id: string, replace = false) {
    if (checkoutBusyRef.current) return;
    const form = checkoutForm(id);
    const pending = pendingPayment(id);
    if (replace && !pending) return;
    if (
      replace &&
      !window.confirm(
        [
          "기존 결제링크는 즉시 사용할 수 없게 됩니다.",
          "",
          `기존 조건: ${pending!.planMonths}개월 · ${toDateInputValue(pending!.periodStart) || "시작일 미정"}`,
          `새 조건: ${form.months}개월 · ${form.startDate}`,
          "",
          "새 링크로 교체하시겠습니까?",
        ].join("\n"),
      )
    ) {
      return;
    }

    checkoutBusyRef.current = id;
    setCheckoutErrors((current) => ({ ...current, [id]: "" }));
    setCheckoutBusyId(id);
    try {
      const checkout = replace
        ? await onReplaceCheckout({
            consultationId: id,
            paymentId: pending!.id,
            planMonths: form.months,
            startDate: form.startDate,
          })
        : await onCreateCheckout({
            consultationId: id,
            planMonths: form.months,
            startDate: form.startDate,
          });
      setProvisionalCheckouts((current) => ({
        ...current,
        [id]: checkout,
      }));
      setReplacementModeId((current) => (current === id ? "" : current));
    } catch (error) {
      setCheckoutErrors((current) => ({
        ...current,
        [id]:
          error instanceof Error
            ? error.message
            : "결제링크를 처리하지 못했습니다.",
      }));
    } finally {
      if (checkoutBusyRef.current === id) checkoutBusyRef.current = "";
      setCheckoutBusyId((current) => (current === id ? "" : current));
    }
  }

  async function copyLink(id: string, link: string) {
    await navigator.clipboard.writeText(link);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(""), 1600);
  }

  const selectedPayments = selectedConsultation?.payments ?? [];
  const selectedProvisional = selectedConsultation
    ? provisionalCheckout(selectedConsultation.id)
    : undefined;
  const selectedPaidPayment = selectedPayments.find(
    (payment) => payment.status === "PAID",
  );
  const selectedPendingPayment = selectedPayments.find(
    (payment) => payment.status === "PENDING",
  );
  const selectedPayment =
    selectedPaidPayment ?? selectedPendingPayment ?? selectedPayments[0];
  const selectedMeetingLink = selectedConsultation
    ? (meetingLinks[selectedConsultation.id] ??
      selectedConsultation.agoraRoomId ??
      "")
    : "";
  const selectedCheckoutLink = selectedConsultation
    ? selectedProvisional
      ? selectedProvisional.checkoutUrl
      : selectedPendingPayment
        ? `${window.location.origin}/checkout/${selectedPendingPayment.id}`
      : ""
    : "";
  const selectedCheckoutForm = selectedConsultation
    ? checkoutForm(selectedConsultation.id)
    : { months: 1, startDate: startMin };
  const isSelectedVideo = selectedConsultation?.consultType === "VIDEO";
  const selectedPaid = Boolean(selectedPaidPayment);
  const selectedPaymentPending = Boolean(
    selectedProvisional || selectedPendingPayment,
  );
  const selectedCheckoutExpired = Boolean(
    selectedProvisional
      ? checkoutExpired(selectedProvisional.checkoutExpiresAt)
      : selectedPendingPayment &&
          checkoutExpired(selectedPendingPayment.checkoutExpiresAt),
  );
  const selectedPendingStart = toDateInputValue(
    selectedProvisional?.periodStart ?? selectedPendingPayment?.periodStart,
  );
  const selectedStartPassed = Boolean(
    !selectedPendingStart || selectedPendingStart < startMin,
  );
  const replacementRequired = selectedPaymentPending && selectedStartPassed;
  const replacingSelected = Boolean(
    selectedConsultation &&
    (replacementModeId === selectedConsultation.id || replacementRequired),
  );
  const selectedCheckoutBusy = Boolean(
    selectedConsultation && checkoutBusyId === selectedConsultation.id,
  );
  const anyCheckoutBusy = Boolean(checkoutBusyId);
  const selectedCheckoutError = selectedConsultation
    ? (checkoutErrors[selectedConsultation.id] ?? "")
    : "";
  const canConfirmSelected =
    selectedConsultation?.status === "PENDING" &&
    (!isSelectedVideo || Boolean(selectedMeetingLink.trim()));

  return (
    <section className="admin-card admin-consultation-directory">
      <div className="admin-consultation-directory-head">
        <h2>상담 관리</h2>
        <span>{pageMeta.total}건</span>
      </div>

      <label className="admin-consultation-directory-search">
        <span>상담 검색</span>
        <input
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="이름, 연락처, 자격증, 지역 검색"
        />
      </label>

      <div className="admin-consultation-directory-workspace">
        <div className="admin-consultation-directory-results">
          <div className="admin-consultation-directory-list">
            <div
              aria-hidden="true"
              className="admin-consultation-directory-list-head"
            >
              <span>상담일</span>
              <span>회원</span>
              <span>연락처</span>
              <span>유형</span>
              <span>상태</span>
              <span />
            </div>

            {consultations.length === 0 && (
              <div className="admin-consultation-directory-empty">
                상담 예약이 없습니다.
              </div>
            )}

            {consultations.map((item) => (
              <button
                aria-pressed={selectedConsultation?.id === item.id}
                className={`admin-consultation-directory-row${selectedConsultation?.id === item.id ? " is-selected" : ""}`}
                disabled={anyCheckoutBusy}
                key={item.id}
                onClick={() => {
                  setSelectedId(item.id);
                  setReplacementModeId("");
                }}
                type="button"
              >
                <span className="admin-consultation-directory-date">
                  {consultationDate(item)}
                </span>
                <span className="admin-consultation-directory-person">
                  <span
                    aria-hidden="true"
                    className="admin-consultation-directory-avatar"
                  >
                    {item.name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {consultationDate(item)} · {consultationType(item)}
                    </small>
                  </span>
                </span>
                <span className="admin-consultation-directory-phone">
                  {item.phone}
                </span>
                <span className="admin-consultation-directory-type">
                  {consultationType(item)}
                </span>
                <em
                  className={`admin-consultation-directory-status ${statusTone(item.status)}`}
                >
                  {consultationStatus(item)}
                </em>
                <span
                  aria-hidden="true"
                  className="admin-consultation-directory-chevron"
                >
                  ›
                </span>
              </button>
            ))}
          </div>

          <AdminPager meta={pageMeta} onPageChange={onPageChange} />
        </div>

        {selectedConsultation && (
          <aside className="admin-consultation-directory-detail">
            <div className="admin-consultation-detail-head">
              <div>
                <span
                  aria-hidden="true"
                  className="admin-consultation-directory-avatar"
                >
                  {selectedConsultation.name.slice(0, 1)}
                </span>
                <div>
                  <strong>{selectedConsultation.name}</strong>
                  <span>{selectedConsultation.phone}</span>
                </div>
              </div>
              <em
                className={`admin-consultation-directory-status ${statusTone(selectedConsultation.status)}`}
              >
                {consultationStatus(selectedConsultation)}
              </em>
            </div>

            <dl className="admin-consultation-detail-fields">
              <div>
                <dt>상담 신청</dt>
                <dd>{dateText(selectedConsultation.createdAt)}</dd>
              </div>
              <div>
                <dt>희망 일정</dt>
                <dd>
                  {consultationDate(selectedConsultation)} ·{" "}
                  {selectedConsultation.timeSlot ?? "시간 미정"}
                </dd>
              </div>
              <div>
                <dt>상담 유형</dt>
                <dd>{consultationType(selectedConsultation)}</dd>
              </div>
              <div>
                <dt>자격증</dt>
                <dd>{selectedConsultation.examType ?? "-"}</dd>
              </div>
              <div>
                <dt>지역</dt>
                <dd>{selectedConsultation.residenceArea ?? "-"}</dd>
              </div>
              <div>
                <dt>준비기간</dt>
                <dd>
                  {selectedConsultation.prepDuration ??
                    selectedConsultation.studyPeriod ??
                    "-"}
                </dd>
              </div>
            </dl>

            {selectedConsultation.adminNotes && (
              <div className="admin-consultation-detail-note">
                <span>관리자 메모</span>
                <p>{selectedConsultation.adminNotes}</p>
              </div>
            )}

            {isSelectedVideo && selectedConsultation.status !== "COMPLETED" && (
              <label className="admin-consultation-video-link">
                <span>화상 상담 링크</span>
                <input
                  value={selectedMeetingLink}
                  onChange={(event) =>
                    setMeetingLinks((current) => ({
                      ...current,
                      [selectedConsultation.id]: event.target.value,
                    }))
                  }
                  placeholder="Google Meet / Zoom 링크를 붙여넣어 주세요"
                />
                {selectedConsultation.agoraRoomId && (
                  <a
                    href={selectedConsultation.agoraRoomId}
                    target="_blank"
                    rel="noreferrer"
                  >
                    저장된 링크 열기
                  </a>
                )}
              </label>
            )}

            <div className="admin-consultation-status-actions">
              {selectedConsultation.status === "PENDING" && (
                <button
                  disabled={!canConfirmSelected}
                  onClick={() =>
                    onConfirm(
                      selectedConsultation.id,
                      selectedConsultation.consultType,
                      selectedMeetingLink,
                    )
                  }
                  type="button"
                >
                  상담 확정
                </button>
              )}
              {selectedConsultation.status === "CONFIRMED" && (
                <button
                  onClick={() => onComplete(selectedConsultation.id)}
                  type="button"
                >
                  상담 완료
                </button>
              )}
              {selectedConsultation.status === "COMPLETED" && (
                <span>상담 처리가 완료되었습니다.</span>
              )}
              {selectedConsultation.status === "CANCELLED" && (
                <span>취소된 상담입니다.</span>
              )}
            </div>

            <div className="admin-consultation-payment-panel">
              <div className="admin-consultation-payment-head">
                <div>
                  <span>결제 및 등록</span>
                  <strong>
                    {selectedPaid
                      ? "결제완료"
                      : selectedPaymentPending
                        ? selectedCheckoutExpired
                          ? "링크만료"
                          : "결제대기"
                        : "링크 미생성"}
                  </strong>
                </div>
                {selectedProvisional ? (
                  <small>
                    {selectedProvisional.planMonths}개월 · 새 링크 발급됨
                  </small>
                ) : selectedPayment ? (
                  <small>
                    {selectedPayment.planMonths}개월 ·{" "}
                    {money(selectedPayment.amount)}
                  </small>
                ) : null}
              </div>

              {selectedPaidPayment?.reviewRequiredAt && (
                <p className="admin-consultation-checkout-warning is-review">
                  교체되거나 취소된 링크에서 결제가 확인되었습니다. 결제
                  관리에서 다른 결제 기록과 포트원을 확인해주세요.
                </p>
              )}

              {!selectedPaid &&
                selectedProvisional &&
                !selectedCheckoutExpired && (
                <p className="admin-consultation-checkout-success">
                  새 결제링크가 발급되었습니다. 아래 링크를 복사해 전달해주세요.
                </p>
              )}

              {!selectedPaid &&
                selectedProvisional &&
                selectedCheckoutExpired && (
                  <p className="admin-consultation-checkout-warning">
                    새 결제링크의 유효 시간이 지났습니다. 새로고침해 최신 상태를
                    확인한 후 재발급해주세요.
                  </p>
                )}

              {!selectedPaid && !selectedProvisional && (
                <>
                  {replacementRequired && (
                    <p className="admin-consultation-checkout-warning">
                      기존 시작일이 지났습니다. 새 시작일을 선택해 링크를
                      교체해주세요.
                    </p>
                  )}
                  {replacingSelected && !replacementRequired && (
                    <p className="admin-consultation-checkout-warning">
                      교체하면 기존 링크는 즉시 사용할 수 없습니다. 새 조건을
                      확인해주세요.
                    </p>
                  )}
                  <div className="admin-consultation-checkout-form">
                    <label>
                      <span>이용권</span>
                      <select
                        disabled={
                          anyCheckoutBusy ||
                          (selectedPaymentPending && !replacingSelected)
                        }
                        value={selectedCheckoutForm.months}
                        onChange={(event) =>
                          updateCheckoutForm(selectedConsultation.id, {
                            months: Number(event.target.value),
                          })
                        }
                      >
                        <option value={1}>1개월</option>
                        <option value={2}>2개월</option>
                        <option value={3}>3개월</option>
                      </select>
                    </label>
                    <label>
                      <span>시작일</span>
                      <input
                        disabled={
                          anyCheckoutBusy ||
                          (selectedPaymentPending && !replacingSelected)
                        }
                        min={startMin}
                        max={startMax}
                        type="date"
                        value={selectedCheckoutForm.startDate}
                        onChange={(event) =>
                          updateCheckoutForm(selectedConsultation.id, {
                            startDate: event.target.value,
                          })
                        }
                      />
                    </label>
                    <div className="admin-consultation-checkout-actions">
                      <button
                        disabled={anyCheckoutBusy}
                        onClick={() =>
                          void createLink(
                            selectedConsultation.id,
                            replacingSelected,
                          )
                        }
                        type="button"
                      >
                        {selectedCheckoutBusy
                          ? replacingSelected
                            ? "교체 중..."
                            : "발급 중..."
                          : replacingSelected
                            ? "새 결제링크로 교체"
                            : selectedPaymentPending
                              ? "결제링크 재발급"
                              : "결제링크 생성"}
                      </button>
                      {selectedPaymentPending && !replacingSelected && (
                        <button
                          className="is-secondary"
                          disabled={anyCheckoutBusy}
                          onClick={() =>
                            beginReplacement(selectedConsultation.id)
                          }
                          type="button"
                        >
                          조건 변경 후 교체
                        </button>
                      )}
                      {replacingSelected && !replacementRequired && (
                        <button
                          className="is-secondary"
                          disabled={anyCheckoutBusy}
                          onClick={() =>
                            cancelReplacement(selectedConsultation.id)
                          }
                          type="button"
                        >
                          교체 취소
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {selectedCheckoutError && (
                <p className="admin-consultation-checkout-error">
                  {selectedCheckoutError}
                </p>
              )}

              {selectedCheckoutLink &&
                !selectedPaid &&
                !selectedCheckoutExpired &&
                !replacingSelected && (
                <button
                  className="admin-consultation-copy-link"
                  onClick={() =>
                    copyLink(selectedConsultation.id, selectedCheckoutLink)
                  }
                  type="button"
                >
                  {copiedId === selectedConsultation.id
                    ? "링크 복사됨"
                    : "결제링크 복사"}
                </button>
                )}

              {selectedPaid && (
                <button
                  className="admin-consultation-pre-register"
                  onClick={() => onPreparePreRegister(selectedConsultation.id)}
                  type="button"
                >
                  사전등록 준비
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
