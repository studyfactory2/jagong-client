import { useMemo, useState } from "react";
import type { ConsultationRecord, PageMeta } from "../../../lib/types";
import AdminPager from "./AdminPager";
import { dateText, money } from "./admin.utils";

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
  const [meetingLinks, setMeetingLinks] = useState<Record<string, string>>({});
  const [checkoutForms, setCheckoutForms] = useState<
    Record<string, { months: number; startDate: string }>
  >({});
  const [checkoutLinks, setCheckoutLinks] = useState<Record<string, string>>(
    {},
  );
  const [copiedId, setCopiedId] = useState("");
  const startMin = useMemo(todayText, []);
  const startMax = useMemo(maxStartDate, []);

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
        {consultations.map((item) => {
          const isVideo = item.consultType === "VIDEO";
          const meetingLink = meetingLinks[item.id] ?? item.agoraRoomId ?? "";
          const canConfirm =
            item.status === "PENDING" && (!isVideo || meetingLink.trim());
          const payment = item.payments?.[0];
          const createdLink = checkoutLinks[item.id];
          const visibleLink =
            createdLink ||
            (payment ? window.location.origin + "/checkout/" + payment.id : "");
          const paid = payment?.status === "PAID";
          const pendingPayment = payment?.status === "PENDING";
          const form = checkoutForm(item.id);

          return (
            <div className="admin-row is-action is-consultation" key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.phone}</span>
              <span>
                {CONSULT_TYPE_LABEL[item.consultType ?? ""] ?? "상담"}
              </span>
              <span>{STATUS_LABEL[item.status] ?? item.status}</span>
              <em>
                {item.desiredDate ?? dateText(item.createdAt)} ·{" "}
                {item.timeSlot ?? "시간 미정"}
              </em>
              {item.status === "PENDING" && (
                <button
                  disabled={!canConfirm}
                  onClick={() =>
                    onConfirm(item.id, item.consultType, meetingLink)
                  }
                  type="button"
                >
                  확정
                </button>
              )}
              {item.status === "CONFIRMED" && (
                <button onClick={() => onComplete(item.id)} type="button">
                  완료
                </button>
              )}
              {item.status === "COMPLETED" && (
                <span className="admin-status-chip">상담완료</span>
              )}

              <div className="admin-consult-payment">
                <div>
                  <span>결제</span>
                  <strong>
                    {paid
                      ? "결제완료"
                      : pendingPayment
                        ? "결제대기"
                        : "링크 미생성"}
                  </strong>
                  {payment && (
                    <small>
                      {payment.planMonths}개월 · {money(payment.amount)}
                    </small>
                  )}
                </div>
                {!paid && (
                  <>
                    <select
                      value={form.months}
                      onChange={(event) =>
                        updateCheckoutForm(item.id, {
                          months: Number(event.target.value),
                        })
                      }
                    >
                      <option value={1}>1개월</option>
                      <option value={2}>2개월</option>
                      <option value={3}>3개월</option>
                    </select>
                    <input
                      min={startMin}
                      max={startMax}
                      type="date"
                      value={form.startDate}
                      onChange={(event) =>
                        updateCheckoutForm(item.id, {
                          startDate: event.target.value,
                        })
                      }
                    />
                    <button onClick={() => createLink(item.id)} type="button">
                      결제링크 생성
                    </button>
                  </>
                )}
                {visibleLink && (
                  <button
                    className="admin-copy-link"
                    onClick={() => copyLink(item.id, visibleLink)}
                    type="button"
                  >
                    {copiedId === item.id ? "복사됨" : "링크 복사"}
                  </button>
                )}
                {paid && (
                  <button
                    onClick={() => onPreparePreRegister(item.id)}
                    type="button"
                  >
                    사전등록 준비
                  </button>
                )}
              </div>

              {isVideo && item.status !== "COMPLETED" && (
                <label className="admin-consult-link">
                  <span>화상 상담 링크</span>
                  <input
                    value={meetingLink}
                    onChange={(event) =>
                      setMeetingLinks((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    placeholder="Google Meet / Zoom 링크를 붙여넣어 주세요"
                  />
                  {item.agoraRoomId && (
                    <a href={item.agoraRoomId} target="_blank" rel="noreferrer">
                      저장된 링크 열기
                    </a>
                  )}
                </label>
              )}
            </div>
          );
        })}
      </div>
      <AdminPager meta={pageMeta} onPageChange={onPageChange} />
    </section>
  );
}
