import { useState } from "react";
import type { ConsultationRecord, PageMeta } from "../../../lib/types";
import AdminPager from "./AdminPager";
import { dateText } from "./admin.utils";

type ConsultationsProps = {
  consultations: ConsultationRecord[];
  searchText: string;
  onSearchChange: (value: string) => void;
  onConfirm: (id: string, meetingLink?: string) => void;
  onComplete: (id: string) => void;
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
  const [meetingLinks, setMeetingLinks] = useState<Record<string, string>>({});

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

          return (
            <div className="admin-row is-action is-consultation" key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.phone}</span>
              <span>{CONSULT_TYPE_LABEL[item.consultType ?? ""] ?? "상담"}</span>
              <span>{STATUS_LABEL[item.status] ?? item.status}</span>
              <em>
                {item.desiredDate ?? dateText(item.createdAt)} ·{" "}
                {item.timeSlot ?? "시간 미정"}
              </em>
              <button
                disabled={!canConfirm}
                onClick={() => onConfirm(item.id, meetingLink)}
                type="button"
              >
                확정
              </button>
              <button
                disabled={item.status !== "CONFIRMED"}
                onClick={() => onComplete(item.id)}
                type="button"
              >
                완료
              </button>

              {isVideo && (
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
                    <a
                      href={item.agoraRoomId}
                      target="_blank"
                      rel="noreferrer"
                    >
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
