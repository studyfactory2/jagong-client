import { useMemo, useState } from "react";
import type { ConsultationRecord, PageMeta } from "../../../lib/types";
import AdminPager from "./AdminPager";
import { dateOnlyText, dateText, money } from "./admin.utils";

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
  }) => Promise<string>;
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

function todayText(): string {
  return new Date().toISOString().slice(0, 10);
}

function maxStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

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

export default function Consultations(props: ConsultationsProps) {
  const {
    consultations,
    searchText,
    onSearchChange,
    onConfirm,
    onComplete,
    onCreateCheckout,
    onPreparePreRegister,
    pageMeta,
    onPageChange,
  } = props;
  const [selectedId, setSelectedId] = useState("");
  const [meetingLinks, setMeetingLinks] = useState<Record<string, string>>({});
  const [checkoutForms, setCheckoutForms] = useState<
    Record<string, { months: number; startDate: string }>
  >({});
  const [checkoutLinks, setCheckoutLinks] = useState<Record<string, string>>(
    {},
  );
  const [copiedId, setCopiedId] = useState("");
  const startMin = useMemo(() => todayText(), []);
  const startMax = useMemo(() => maxStartDate(), []);
  const selectedConsultation =
    consultations.find((item) => item.id === selectedId) ??
    consultations[0] ??
    null;

  function checkoutForm(id: string) {
    return checkoutForms[id] ?? { months: 1, startDate: startMin };
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

  async function createLink(id: string) {
    const form = checkoutForm(id);
    const link = await onCreateCheckout({
      consultationId: id,
      planMonths: form.months,
      startDate: form.startDate,
    });
    if (link) setCheckoutLinks((current) => ({ ...current, [id]: link }));
  }

  async function copyLink(id: string, link: string) {
    await navigator.clipboard.writeText(link);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(""), 1600);
  }

  const selectedPayment = selectedConsultation?.payments?.[0];
  const selectedMeetingLink = selectedConsultation
    ? (meetingLinks[selectedConsultation.id] ??
      selectedConsultation.agoraRoomId ??
      "")
    : "";
  const selectedCheckoutLink = selectedConsultation
    ? (checkoutLinks[selectedConsultation.id] ??
      (selectedPayment
        ? `${window.location.origin}/checkout/${selectedPayment.id}`
        : ""))
    : "";
  const selectedCheckoutForm = selectedConsultation
    ? checkoutForm(selectedConsultation.id)
    : { months: 1, startDate: startMin };
  const isSelectedVideo = selectedConsultation?.consultType === "VIDEO";
  const selectedPaid = selectedPayment?.status === "PAID";
  const selectedPaymentPending = selectedPayment?.status === "PENDING";
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
                key={item.id}
                onClick={() => setSelectedId(item.id)}
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
                        ? "결제대기"
                        : "링크 미생성"}
                  </strong>
                </div>
                {selectedPayment && (
                  <small>
                    {selectedPayment.planMonths}개월 ·{" "}
                    {money(selectedPayment.amount)}
                  </small>
                )}
              </div>

              {!selectedPaid && (
                <div className="admin-consultation-checkout-form">
                  <label>
                    <span>이용권</span>
                    <select
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
                  <button
                    onClick={() => createLink(selectedConsultation.id)}
                    type="button"
                  >
                    결제링크 생성
                  </button>
                </div>
              )}

              {selectedCheckoutLink && (
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
