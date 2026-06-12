import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import type { AdminUser } from "../../../lib/types";
import type { AdminStats } from "./admin.types";

type OverviewProps = {
  stats: AdminStats;
  users: AdminUser[];
  noticeTitle: string;
  noticeContent: string;
  manualUserId: string;
  manualMonths: number;
  manualName: string;
  manualReceiptFile: File | null;
  savingManualPayment: boolean;
  onNoticeTitleChange: (value: string) => void;
  onNoticeContentChange: (value: string) => void;
  onManualUserChange: (value: string) => void;
  onManualMonthsChange: (value: number) => void;
  onManualNameChange: (value: string) => void;
  onManualReceiptChange: (file: File | null) => void;
  onSaveNotice: () => void;
  onSaveManualPayment: () => void;
};

export default function Overview(props: OverviewProps) {
  const {
    stats,
    users,
    noticeTitle,
    noticeContent,
    manualUserId,
    manualMonths,
    manualName,
    manualReceiptFile,
    savingManualPayment,
    onNoticeTitleChange,
    onNoticeContentChange,
    onManualUserChange,
    onManualMonthsChange,
    onManualNameChange,
    onManualReceiptChange,
    onSaveNotice,
    onSaveManualPayment,
  } = props;

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

      <section className="admin-card admin-notice-card">
        <h2>
          <AdminPanelSettingsOutlinedIcon /> 공지 작성
        </h2>
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
      </section>

      <section className="admin-card admin-notice-card">
        <h2>
          <CreditCardOutlinedIcon /> 수동 결제 등록
        </h2>
        <select
          value={manualUserId}
          onChange={(event) => onManualUserChange(event.target.value)}
        >
          {users
            .filter((user) => user.role === "MEMBER")
            .map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
        </select>
        <select
          value={manualMonths}
          onChange={(event) => onManualMonthsChange(Number(event.target.value))}
        >
          <option value={1}>1개월</option>
          <option value={2}>2개월</option>
          <option value={3}>3개월</option>
        </select>
        <input
          value={manualName}
          onChange={(event) => onManualNameChange(event.target.value)}
          placeholder="입금자명"
        />
        <label className="admin-payment-upload">
          <span>입금 확인 사진</span>
          <strong>{manualReceiptFile?.name ?? "사진 선택"}</strong>
          <input
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => onManualReceiptChange(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        <button disabled={savingManualPayment} onClick={onSaveManualPayment} type="button">
          {savingManualPayment ? "등록중" : "수동 결제 등록"}
        </button>
      </section>
    </section>
  );
}
