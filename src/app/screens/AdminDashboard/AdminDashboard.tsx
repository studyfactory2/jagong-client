import { useEffect, useMemo, useState } from "react";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import AppShell from "../../components/ui/AppShell";
import { useAuth } from "../../context/AuthContext";
import {
  getAdminUsers,
} from "../../services/admin.service";
import {
  getAdminConsultations,
  updateConsultation,
} from "../../services/consultation.service";
import {
  getAdminPayments,
  recordManualPayment,
} from "../../services/membership.service";
import {
  approveLeave,
  getAdminLeaves,
  rejectLeave,
} from "../../services/leave.service";
import {
  getAdminChat,
  replyChatMessage,
} from "../../services/chat.service";
import { getCamSessions } from "../../services/cam.service";
import { createNotice } from "../../services/notice.service";
import type {
  AdminUser,
  CamSessionRecord,
  ChatMessage,
  ConsultationRecord,
  LeaveRecord,
  PaymentRecord,
} from "../../../lib/types";
import "./admin-dashboard.css";

type TabKey = "overview" | "members" | "consultations" | "payments" | "leaves" | "chat" | "camera";

type AdminData = {
  users: AdminUser[];
  consultations: ConsultationRecord[];
  payments: PaymentRecord[];
  leaves: LeaveRecord[];
  chats: ChatMessage[];
  camSessions: CamSessionRecord[];
};

const emptyData: AdminData = {
  users: [],
  consultations: [],
  payments: [],
  leaves: [],
  chats: [],
  camSessions: [],
};

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "대시보드" },
  { key: "members", label: "회원" },
  { key: "consultations", label: "상담" },
  { key: "payments", label: "결제" },
  { key: "leaves", label: "휴가" },
  { key: "chat", label: "문의" },
  { key: "camera", label: "캠" },
];

function dateText(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function money(value: number) {
  return value.toLocaleString("ko-KR") + "원";
}

function userName(users: AdminUser[], userId: string) {
  return users.find((user) => user.id === userId || user.userId === userId)?.name ?? "-";
}

export default function AdminDashboard() {
  const { session } = useAuth();
  const [tab, setTab] = useState<TabKey>("overview");
  const [data, setData] = useState<AdminData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [manualUserId, setManualUserId] = useState("");
  const [manualMonths, setManualMonths] = useState(1);
  const [manualName, setManualName] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const allowed = session?.user.role === "ADMIN" || session?.user.role === "STAFF";

  async function load() {
    if (!allowed) return;
    setError("");
    setLoading(true);
    try {
      const [usersResult, consultations, payments, leaves, chats, camSessions] = await Promise.all([
        getAdminUsers(),
        getAdminConsultations(),
        getAdminPayments(),
        getAdminLeaves(),
        getAdminChat(),
        getCamSessions(),
      ]);
      setData({ users: usersResult.list, consultations, payments, leaves, chats, camSessions });
      setManualUserId((current) => current || usersResult.list[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "관리자 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [allowed]);

  const stats = useMemo(() => {
    const pendingConsultations = data.consultations.filter((item) => item.status === "PENDING").length;
    const pendingLeaves = data.leaves.filter((item) => item.status === "PENDING").length;
    const paid = data.payments.filter((item) => item.status === "PAID").length;
    const activeMembers = data.users.filter((user) => user.role === "MEMBER" && user.isActive).length;
    const working = data.camSessions.filter((sessionItem) => !sessionItem.leftAt).length;
    const unanswered = data.chats.filter((chat) => !chat.reply).length;
    return { pendingConsultations, pendingLeaves, paid, activeMembers, working, unanswered };
  }, [data]);

  async function saveNotice() {
    if (!noticeTitle.trim() || !noticeContent.trim()) return;
    await createNotice({ title: noticeTitle, content: noticeContent });
    setNoticeTitle("");
    setNoticeContent("");
  }

  async function saveManualPayment() {
    if (!manualUserId || !manualName.trim()) return;
    await recordManualPayment({
      userId: manualUserId,
      planMonths: manualMonths,
      depositorName: manualName,
      paidAt: new Date().toISOString(),
    });
    setManualName("");
    await load();
  }

  async function completeConsultation(id: string) {
    await updateConsultation(id, { status: "COMPLETED" });
    await load();
  }

  async function confirmConsultation(id: string) {
    await updateConsultation(id, { status: "CONFIRMED" });
    await load();
  }

  async function handleLeave(id: string, action: "approve" | "reject") {
    if (action === "approve") await approveLeave(id);
    else await rejectLeave(id);
    await load();
  }

  async function sendReply(id: string) {
    const reply = replyDrafts[id]?.trim();
    if (!reply) return;
    await replyChatMessage(id, reply);
    setReplyDrafts((current) => ({ ...current, [id]: "" }));
    await load();
  }

  const actions = (
    <button className="admin-refresh" onClick={load} type="button">
      <RefreshOutlinedIcon /> 새로고침
    </button>
  );

  if (!allowed) {
    return (
      <AppShell title="관리자" subtitle="접근 권한이 필요합니다" wide actions={actions}>
        <section className="admin-empty">관리자 또는 스태프 계정으로 로그인해 주세요.</section>
      </AppShell>
    );
  }

  return (
    <AppShell title="관리자 작업실" subtitle="회원 · 상담 · 결제 · 휴가 · 캠 상태 관리" wide actions={actions}>
      <div className="admin">
        <nav className="admin-tabs" aria-label="관리자 메뉴">
          {tabs.map((item) => (
            <button className={tab === item.key ? "is-active" : ""} key={item.key} onClick={() => setTab(item.key)} type="button">
              {item.label}
            </button>
          ))}
        </nav>

        {error && <p className="admin-error">{error}</p>}
        {loading && <p className="admin-loading">관리자 데이터를 불러오는 중입니다.</p>}

        {tab === "overview" && (
          <section className="admin-grid">
            <article className="admin-stat"><GroupsOutlinedIcon /><span>활성 회원</span><strong>{stats.activeMembers}</strong></article>
            <article className="admin-stat"><AssignmentTurnedInOutlinedIcon /><span>상담 대기</span><strong>{stats.pendingConsultations}</strong></article>
            <article className="admin-stat"><CreditCardOutlinedIcon /><span>완료 결제</span><strong>{stats.paid}</strong></article>
            <article className="admin-stat"><CalendarMonthOutlinedIcon /><span>휴가 대기</span><strong>{stats.pendingLeaves}</strong></article>
            <article className="admin-stat"><ChatBubbleOutlineOutlinedIcon /><span>미답변 문의</span><strong>{stats.unanswered}</strong></article>
            <article className="admin-stat"><VideocamOutlinedIcon /><span>캠 입장</span><strong>{stats.working}</strong></article>

            <section className="admin-card admin-notice-card">
              <h2><AdminPanelSettingsOutlinedIcon /> 공지 작성</h2>
              <input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} placeholder="공지 제목" />
              <textarea value={noticeContent} onChange={(event) => setNoticeContent(event.target.value)} placeholder="공지 내용을 입력하세요" />
              <button onClick={saveNotice} type="button">공지 등록</button>
            </section>

            <section className="admin-card admin-notice-card">
              <h2><CreditCardOutlinedIcon /> 수동 결제 등록</h2>
              <select value={manualUserId} onChange={(event) => setManualUserId(event.target.value)}>
                {data.users.filter((user) => user.role === "MEMBER").map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
              <select value={manualMonths} onChange={(event) => setManualMonths(Number(event.target.value))}>
                <option value={1}>1개월</option>
                <option value={2}>2개월</option>
                <option value={3}>3개월</option>
              </select>
              <input value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder="입금자명" />
              <button onClick={saveManualPayment} type="button">수동 결제 등록</button>
            </section>
          </section>
        )}

        {tab === "members" && (
          <section className="admin-card">
            <h2>회원 목록</h2>
            <div className="admin-table">
              {data.users.map((user) => (
                <div className="admin-row" key={user.id}>
                  <strong>{user.name}</strong>
                  <span>{user.role}</span>
                  <span>{user.phone ?? "연락처 없음"}</span>
                  <span>{user.isActive ? "활성" : "대기/비활성"}</span>
                  <em>{user.membershipEnd ? "만료 " + dateText(user.membershipEnd) : "이용권 없음"}</em>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "consultations" && (
          <section className="admin-card">
            <h2>상담 예약</h2>
            <div className="admin-table">
              {data.consultations.map((item) => (
                <div className="admin-row is-action" key={item.id}>
                  <strong>{item.name}</strong>
                  <span>{item.phone}</span>
                  <span>{item.consultType ?? "상담"}</span>
                  <span>{item.status}</span>
                  <em>{item.desiredDate ?? dateText(item.createdAt)} · {item.timeSlot ?? "시간 미정"}</em>
                  <button onClick={() => confirmConsultation(item.id)} type="button">확정</button>
                  <button onClick={() => completeConsultation(item.id)} type="button">완료</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "payments" && (
          <section className="admin-card">
            <h2>결제 내역</h2>
            <div className="admin-table">
              {data.payments.map((payment) => (
                <div className="admin-row" key={payment.id}>
                  <strong>{userName(data.users, payment.userId)}</strong>
                  <span>{payment.planMonths}개월</span>
                  <span>{payment.status}</span>
                  <span>{money(payment.amount)}</span>
                  <em>{dateText(payment.createdAt)}</em>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "leaves" && (
          <section className="admin-card">
            <h2>휴가 신청</h2>
            <div className="admin-table">
              {data.leaves.map((leave) => (
                <div className="admin-row is-action" key={leave.id}>
                  <strong>{leave.user?.name ?? userName(data.users, leave.userId)}</strong>
                  <span>{leave.leaveType}</span>
                  <span>{leave.status}</span>
                  <span>{dateText(leave.date)}</span>
                  <em>{leave.reason ?? "사유 없음"}</em>
                  <button onClick={() => handleLeave(leave.id, "approve")} type="button">승인</button>
                  <button onClick={() => handleLeave(leave.id, "reject")} type="button">반려</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "chat" && (
          <section className="admin-card">
            <h2>1:1 문의</h2>
            <div className="admin-table">
              {data.chats.map((chat) => (
                <div className="admin-chat-row" key={chat.id}>
                  <div><strong>{chat.user?.name ?? userName(data.users, chat.userId)}</strong><p>{chat.message}</p>{chat.reply && <em>답변: {chat.reply}</em>}</div>
                  <input value={replyDrafts[chat.id] ?? ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [chat.id]: event.target.value }))} placeholder="답변 입력" />
                  <button onClick={() => sendReply(chat.id)} type="button">답변</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "camera" && (
          <section className="admin-card">
            <h2>캠 세션</h2>
            <div className="admin-table">
              {data.camSessions.map((cam) => (
                <div className="admin-row" key={cam.id}>
                  <strong>{cam.user?.name ?? userName(data.users, cam.userId)}</strong>
                  <span>{cam.slot}교시</span>
                  <span>{cam.leftAt ? "퇴장" : "입장중"}</span>
                  <span>{dateText(cam.joinedAt ?? cam.date)}</span>
                  <em>{cam.leftAt ? dateText(cam.leftAt) : "진행 중"}</em>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
