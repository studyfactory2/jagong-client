import { useMemo, useState } from "react";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import type { AdminUser } from "../../../lib/types";
import type { AdminStats } from "./admin.types";
import { membershipEndText, money } from "./admin.utils";

type OverviewProps = {
  stats: AdminStats;
  users: AdminUser[];
  noticeTitle: string;
  noticeContent: string;
  manualUserId: string;
  manualMonths: number;
  manualName: string;
  manualPaidAt: string;
  manualStartDate: string;
  manualMemo: string;
  manualReceiptFile: File | null;
  savingManualPayment: boolean;
  onNoticeTitleChange: (value: string) => void;
  onNoticeContentChange: (value: string) => void;
  onManualUserChange: (value: string) => void;
  onManualMonthsChange: (value: number) => void;
  onManualNameChange: (value: string) => void;
  onManualPaidAtChange: (value: string) => void;
  onManualStartDateChange: (value: string) => void;
  onManualMemoChange: (value: string) => void;
  onManualReceiptChange: (file: File | null) => void;
  onSaveNotice: () => void;
  onSaveManualPayment: () => void;
};

const MANUAL_PAYMENT_PLANS = [
  { months: 1, amount: 370000 },
  { months: 2, amount: 700000 },
  { months: 3, amount: 990000 },
] as const;

export default function Overview(props: OverviewProps) {
  const {
    stats,
    users,
    noticeTitle,
    noticeContent,
    manualUserId,
    manualMonths,
    manualName,
    manualPaidAt,
    manualStartDate,
    manualMemo,
    manualReceiptFile,
    savingManualPayment,
    onNoticeTitleChange,
    onNoticeContentChange,
    onManualUserChange,
    onManualMonthsChange,
    onManualNameChange,
    onManualPaidAtChange,
    onManualStartDateChange,
    onManualMemoChange,
    onManualReceiptChange,
    onSaveNotice,
    onSaveManualPayment,
  } = props;

  const [manualUserSearch, setManualUserSearch] = useState("");
  const manualUsers = useMemo(() => {
    const query = manualUserSearch.trim().toLowerCase();
    return users
      .filter((user) => user.role === "MEMBER")
      .filter((user) => {
        if (!query) return true;
        return [user.name, user.phone, user.examType, user.residenceArea]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      });
  }, [manualUserSearch, users]);
  const selectedManualUser = users.find((user) => user.id === manualUserId);
  const currentMembershipEnd = selectedManualUser?.membershipEnd
    ? membershipEndText(selectedManualUser.membershipEnd)
    : null;
  const selectedManualPlan =
    MANUAL_PAYMENT_PLANS.find((plan) => plan.months === manualMonths) ??
    MANUAL_PAYMENT_PLANS[0];

  return (
    <section className="admin-grid">
      <article className="admin-stat">
        <GroupsOutlinedIcon />
        <span>활성 회원</span>
        <strong>{stats.activeMembers}</strong>
      </article>
      <article className="admin-stat">
        <AssignmentTurnedInOutlinedIcon />
        <span>상담 대기</span>
        <strong>{stats.pendingConsultations}</strong>
      </article>
      <article className="admin-stat">
        <CreditCardOutlinedIcon />
        <span>완료 결제</span>
        <strong>{stats.paid}</strong>
      </article>
      <article className="admin-stat">
        <CalendarMonthOutlinedIcon />
        <span>휴가 대기</span>
        <strong>{stats.pendingLeaves}</strong>
      </article>
      <article className="admin-stat">
        <ChatBubbleOutlineOutlinedIcon />
        <span>미답변 문의</span>
        <strong>{stats.unanswered}</strong>
      </article>
      <article className="admin-stat">
        <VideocamOutlinedIcon />
        <span>캠 입장</span>
        <strong>{stats.working}</strong>
      </article>

      <section className="admin-card admin-notice-card admin-compact-notice">
        <h2>
          <AdminPanelSettingsOutlinedIcon /> 공지 작성
        </h2>
        <div className="admin-notice-fields">
          <input
            value={noticeTitle}
            onChange={(event) => onNoticeTitleChange(event.target.value)}
            placeholder="공지 제목"
          />
          <textarea
            value={noticeContent}
            onChange={(event) => onNoticeContentChange(event.target.value)}
            placeholder="공지 내용을 입력하세요"
          />
          <button onClick={onSaveNotice} type="button">
            공지 등록
          </button>
        </div>
      </section>

      <section className="admin-card admin-notice-card admin-manual-payment-card">
        <h2>
          <CreditCardOutlinedIcon /> 수동 결제 등록
        </h2>
        <label className="admin-search">
          <span>결제 회원 검색</span>
          <input
            value={manualUserSearch}
            onChange={(event) => setManualUserSearch(event.target.value)}
            placeholder="이름, 연락처, 자격증, 지역 검색"
          />
        </label>
        <select
          value={manualUserId}
          onChange={(event) => onManualUserChange(event.target.value)}
        >
          {manualUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        <label className="admin-payment-field">
          <span>이용권</span>
          <select
            value={manualMonths}
            onChange={(event) =>
              onManualMonthsChange(Number(event.target.value))
            }
          >
            {MANUAL_PAYMENT_PLANS.map((plan) => (
              <option key={plan.months} value={plan.months}>
                {plan.months}개월
              </option>
            ))}
          </select>
        </label>
        <label className="admin-payment-field">
          <span>결제 금액</span>
          <select disabled value={selectedManualPlan.amount}>
            {MANUAL_PAYMENT_PLANS.map((plan) => (
              <option key={plan.amount} value={plan.amount}>
                {money(plan.amount)}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-payment-field">
          <span>입금자명</span>
          <input
            value={manualName}
            onChange={(event) => onManualNameChange(event.target.value)}
            placeholder="예: 홍길동"
          />
          <small>
            통장에 표시된 입금자명입니다. 결제 회원과 다를 수 있습니다.
          </small>
        </label>
        <div className="admin-payment-date-grid">
          <label>
            <span>입금 확인일</span>
            <input
              type="date"
              value={manualPaidAt}
              onChange={(event) => onManualPaidAtChange(event.target.value)}
            />
          </label>
          <label>
            <span>이용 시작일</span>
            <input
              type="date"
              value={manualStartDate}
              onChange={(event) => onManualStartDateChange(event.target.value)}
            />
          </label>
        </div>
        {currentMembershipEnd && (
          <p className="admin-payment-hint">
            기존 이용권 종료 기준: {currentMembershipEnd}. 남은 기간이 있으면 새
            이용권은 기존 종료일 다음 날부터 자동으로 이어집니다.
          </p>
        )}
        <textarea
          value={manualMemo}
          onChange={(event) => onManualMemoChange(event.target.value)}
          placeholder="관리자 메모 (선택)"
        />
        <label className="admin-payment-upload">
          <span>입금 확인 사진</span>
          <strong>{manualReceiptFile?.name ?? "사진 선택"}</strong>
          <input
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) =>
              onManualReceiptChange(event.target.files?.[0] ?? null)
            }
            type="file"
          />
        </label>
        <button
          disabled={savingManualPayment}
          onClick={onSaveManualPayment}
          type="button"
        >
          {savingManualPayment ? "등록중" : "수동 결제 등록"}
        </button>
      </section>
    </section>
  );
}
