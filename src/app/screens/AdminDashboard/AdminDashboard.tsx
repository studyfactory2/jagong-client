import { useEffect, useMemo, useState } from "react";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import AppShell from "../../components/ui/AppShell";
import { useAuth } from "../../context/AuthContext";
import { getAdminUsers } from "../../services/admin.service";
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
import Camera from "./Camera";
import Chat from "./Chat";
import Consultations from "./Consultations";
import Leaves from "./Leaves";
import Members from "./Members";
import Overview from "./Overview";
import Payments from "./Payments";
import {
  adminTabs,
  emptyAdminData,
  type AdminData,
  type AdminStats,
  type AdminTabKey,
} from "./admin.types";
import "./admin-dashboard.css";

export default function AdminDashboard() {
  /** STATE **/
  const { session } = useAuth();
  const [tab, setTab] = useState<AdminTabKey>("overview");
  const [data, setData] = useState<AdminData>(emptyAdminData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [manualUserId, setManualUserId] = useState("");
  const [manualMonths, setManualMonths] = useState(1);
  const [manualName, setManualName] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  /** DERIVED **/
  const allowed = session?.user.role === "ADMIN" || session?.user.role === "STAFF";

  const stats: AdminStats = useMemo(() => {
    const pendingConsultations = data.consultations.filter(
      (item) => item.status === "PENDING",
    ).length;
    const pendingLeaves = data.leaves.filter(
      (item) => item.status === "PENDING",
    ).length;
    const paid = data.payments.filter((item) => item.status === "PAID").length;
    const activeMembers = data.users.filter(
      (user) => user.role === "MEMBER" && user.isActive,
    ).length;
    const working = data.camSessions.filter((sessionItem) => !sessionItem.leftAt).length;
    const unanswered = data.chats.filter((chat) => !chat.reply).length;
    return { pendingConsultations, pendingLeaves, paid, activeMembers, working, unanswered };
  }, [data]);

  /** EFFECTS **/
  useEffect(() => {
    load();
  }, [allowed]);

  /** HANDLERS **/
  async function load() {
    if (!allowed) return;
    setError("");
    setLoading(true);
    try {
      const [usersResult, consultations, payments, leaves, chats, camSessions] =
        await Promise.all([
          getAdminUsers(),
          getAdminConsultations(),
          getAdminPayments(),
          getAdminLeaves(),
          getAdminChat(),
          getCamSessions(),
        ]);
      setData({
        users: usersResult.list,
        consultations,
        payments,
        leaves,
        chats,
        camSessions,
      });
      setManualUserId((current) => current || usersResult.list[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "관리자 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

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

  function updateReplyDraft(id: string, value: string) {
    setReplyDrafts((current) => ({ ...current, [id]: value }));
  }

  async function sendReply(id: string) {
    const reply = replyDrafts[id]?.trim();
    if (!reply) return;
    await replyChatMessage(id, reply);
    setReplyDrafts((current) => ({ ...current, [id]: "" }));
    await load();
  }

  /** RENDER **/
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
          {adminTabs.map((item) => (
            <button
              className={tab === item.key ? "is-active" : ""}
              key={item.key}
              onClick={() => setTab(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {error && <p className="admin-error">{error}</p>}
        {loading && <p className="admin-loading">관리자 데이터를 불러오는 중입니다.</p>}

        {tab === "overview" && (
          <Overview
            stats={stats}
            users={data.users}
            noticeTitle={noticeTitle}
            noticeContent={noticeContent}
            manualUserId={manualUserId}
            manualMonths={manualMonths}
            manualName={manualName}
            onNoticeTitleChange={setNoticeTitle}
            onNoticeContentChange={setNoticeContent}
            onManualUserChange={setManualUserId}
            onManualMonthsChange={setManualMonths}
            onManualNameChange={setManualName}
            onSaveNotice={saveNotice}
            onSaveManualPayment={saveManualPayment}
          />
        )}

        {tab === "members" && <Members users={data.users} />}

        {tab === "consultations" && (
          <Consultations
            consultations={data.consultations}
            onConfirm={confirmConsultation}
            onComplete={completeConsultation}
          />
        )}

        {tab === "payments" && (
          <Payments payments={data.payments} users={data.users} />
        )}

        {tab === "leaves" && (
          <Leaves leaves={data.leaves} users={data.users} onAction={handleLeave} />
        )}

        {tab === "chat" && (
          <Chat
            chats={data.chats}
            users={data.users}
            replyDrafts={replyDrafts}
            onReplyDraftChange={updateReplyDraft}
            onReply={sendReply}
          />
        )}

        {tab === "camera" && (
          <Camera camSessions={data.camSessions} users={data.users} />
        )}
      </div>
    </AppShell>
  );
}
