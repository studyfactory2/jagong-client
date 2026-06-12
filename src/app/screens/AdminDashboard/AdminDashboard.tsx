import { useEffect, useMemo, useState } from "react";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import AppShell from "../../components/ui/AppShell";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { createStaffUser, getAdminUsers, preRegisterUser, updateAdminUser } from "../../services/admin.service";
import { getMe, updateMyProfile } from "../../services/auth.service";
import {
  getAdminConsultations,
  updateConsultation,
} from "../../services/consultation.service";
import {
  attachPaymentReceipt,
  getAdminPayments,
  recordManualPayment,
} from "../../services/membership.service";
import {
  approveLeave,
  getAdminLeaves,
  rejectLeave,
} from "../../services/leave.service";
import { getAdminChatRooms } from "../../services/chat.service";
import { getCamSessions, warnStudent } from "../../services/cam.service";
import { createNotice } from "../../services/notice.service";
import { getBranches } from "../../services/branch.service";
import { getTimetable } from "../../services/timetable.service";
import Camera from "./Camera";
import Chat from "./Chat";
import Consultations from "./Consultations";
import Leaves from "./Leaves";
import Members from "./Members";
import Overview from "./Overview";
import Payments from "./Payments";
import Profile from "./Profile";
import type { AdminUser, Branch, TimetableSlot } from "../../../lib/types";
import {
  adminTabs,
  emptyAdminData,
  emptyAdminPageMeta,
  staffTabs,
  type AdminData,
  type AdminStats,
  type AdminTabKey,
} from "./admin.types";
import "./admin-dashboard.css";

export default function AdminDashboard() {
  /** STATE **/
  const { session, refreshUser } = useAuth();
  const { socket } = useSocket();
  const [tab, setTab] = useState<AdminTabKey>("camera");
  const [data, setData] = useState<AdminData>(emptyAdminData);
  const [pageMeta, setPageMeta] = useState(emptyAdminPageMeta);
  const [pages, setPages] = useState({
    users: 1,
    consultations: 1,
    payments: 1,
    leaves: 1,
    chats: 1,
  });
  const [profileUser, setProfileUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [manualUserId, setManualUserId] = useState("");
  const [manualMonths, setManualMonths] = useState(1);
  const [manualName, setManualName] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [manualReceiptFile, setManualReceiptFile] = useState<File | null>(null);
  const [savingManualPayment, setSavingManualPayment] = useState(false);
  const [preRegister, setPreRegister] = useState({
    name: "",
    branchId: "",
    phone: "",
    residenceArea: "",
    age: "",
    examType: "",
    prepDuration: "",
    notes: "",
  });
  const [staffForm, setStaffForm] = useState({
    name: "",
    password: "",
    branchId: "",
    phone: "",
  });

  /** DERIVED **/
  const role = session?.user.role;
  const isAdmin = role === "ADMIN";
  const isStaff = role === "STAFF";
  const allowed = isAdmin || isStaff;
  const visibleTabs = isAdmin ? adminTabs : staffTabs;

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
    const unanswered = data.chats.reduce(
      (sum, room) => sum + (room.unreadCount ?? 0),
      0,
    );
    return { pendingConsultations, pendingLeaves, paid, activeMembers, working, unanswered };
  }, [data]);

  /** EFFECTS **/
  useEffect(() => {
    load();
  }, [allowed, isAdmin, pages.users, pages.consultations, pages.payments, pages.leaves, pages.chats]);

  useEffect(() => {
    if (!visibleTabs.some((item) => item.key === tab)) {
      setTab(visibleTabs[0]?.key ?? "camera");
    }
  }, [tab, visibleTabs]);

  useEffect(() => {
    if (!socket || !allowed) return;
    const refreshCamera = () => load();
    socket.on("cam:join", refreshCamera);
    socket.on("cam:leave", refreshCamera);
    socket.on("cam:alert", refreshCamera);
    socket.on("cam:warning-sent", refreshCamera);
    socket.on("chat:room-updated", refreshCamera);
    return () => {
      socket.off("cam:join", refreshCamera);
      socket.off("cam:leave", refreshCamera);
      socket.off("cam:alert", refreshCamera);
      socket.off("cam:warning-sent", refreshCamera);
      socket.off("chat:room-updated", refreshCamera);
    };
  }, [socket, allowed, isAdmin]);

  /** HANDLERS **/
  async function load() {
    if (!allowed) return;
    setError("");
    setLoading(true);
    try {
      const [usersResult, branchData, timetableData, chatsResult, camSessions, me] = await Promise.all([
        getAdminUsers({ page: pages.users, limit: 12 }),
        getBranches(),
        getTimetable(),
        getAdminChatRooms({ page: pages.chats, limit: 12 }),
        getCamSessions(),
        getMe(),
      ]);

      const [consultations, payments, leaves] = isAdmin
        ? await Promise.all([
            getAdminConsultations({ page: pages.consultations, limit: 10 }),
            getAdminPayments({ page: pages.payments, limit: 10 }),
            getAdminLeaves({ page: pages.leaves, limit: 10 }),
          ])
        : [
            { ...emptyAdminPageMeta.consultations, list: [] },
            { ...emptyAdminPageMeta.payments, list: [] },
            { ...emptyAdminPageMeta.leaves, list: [] },
          ];

      setBranches(branchData);
      setTimetable(timetableData);
      setProfileUser(me as AdminUser);
      setData({
        users: usersResult.list,
        consultations: consultations.list ?? [],
        payments: payments.list ?? [],
        leaves: leaves.list ?? [],
        chats: chatsResult.list,
        camSessions,
      });
      setPageMeta({
        users: usersResult,
        consultations: consultations.list ? consultations : emptyAdminPageMeta.consultations,
        payments: payments.list ? payments : emptyAdminPageMeta.payments,
        leaves: leaves.list ? leaves : emptyAdminPageMeta.leaves,
        chats: chatsResult,
      });
      setManualUserId((current) => current || usersResult.list[0]?.id || "");
      setPreRegister((current) => ({
        ...current,
        branchId: current.branchId || branchData[0]?.id || "",
      }));
      setStaffForm((current) => ({
        ...current,
        branchId: current.branchId || branchData[0]?.id || "",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "관리자 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function saveNotice() {
    if (!isAdmin || !noticeTitle.trim() || !noticeContent.trim()) return;
    await createNotice({ title: noticeTitle, content: noticeContent });
    setNoticeTitle("");
    setNoticeContent("");
  }

  function updatePreRegister(field: keyof typeof preRegister, value: string) {
    setPreRegister((current) => ({ ...current, [field]: value }));
  }

  async function savePreRegister() {
    if (!isAdmin || !preRegister.name.trim() || !preRegister.branchId) return;
    await preRegisterUser({
      name: preRegister.name.trim(),
      branchId: preRegister.branchId,
      phone: preRegister.phone.trim() || undefined,
      residenceArea: preRegister.residenceArea.trim() || undefined,
      age: preRegister.age ? Number(preRegister.age) : undefined,
      examType: preRegister.examType.trim() || undefined,
      prepDuration: preRegister.prepDuration.trim() || undefined,
      notes: preRegister.notes.trim() || undefined,
    });
    setPreRegister((current) => ({
      ...current,
      name: "",
      phone: "",
      residenceArea: "",
      age: "",
      examType: "",
      prepDuration: "",
      notes: "",
    }));
    await load();
  }

  async function saveManualPayment() {
    if (!isAdmin || !manualUserId || !manualName.trim() || savingManualPayment) return;
    setSavingManualPayment(true);
    try {
      const payment = await recordManualPayment({
        userId: manualUserId,
        planMonths: manualMonths,
        depositorName: manualName,
        paidAt: new Date().toISOString(),
      });
      if (manualReceiptFile) {
        await attachPaymentReceipt(payment.id, manualReceiptFile);
      }
      setManualName("");
      setManualReceiptFile(null);
      await load();
    } finally {
      setSavingManualPayment(false);
    }
  }

  async function completeConsultation(id: string) {
    if (!isAdmin) return;
    await updateConsultation(id, { status: "COMPLETED" });
    await load();
  }

  async function confirmConsultation(id: string) {
    if (!isAdmin) return;
    await updateConsultation(id, { status: "CONFIRMED" });
    await load();
  }

  async function handleLeave(id: string, action: "approve" | "reject") {
    if (!isAdmin) return;
    if (action === "approve") await approveLeave(id);
    else await rejectLeave(id);
    await load();
  }

  function updateStaffForm(field: keyof typeof staffForm, value: string) {
    setStaffForm((current) => ({ ...current, [field]: value }));
  }

  async function saveStaff() {
    if (!isAdmin || !staffForm.name.trim() || staffForm.password.length !== 4) return;
    await createStaffUser({
      name: staffForm.name.trim(),
      password: staffForm.password,
      role: "STAFF",
      branchId: staffForm.branchId || undefined,
      phone: staffForm.phone.trim() || undefined,
    });
    setStaffForm((current) => ({
      ...current,
      name: "",
      password: "",
      phone: "",
    }));
    await load();
  }

  async function saveUserProfile(userId: string, input: Partial<(typeof data.users)[number]>) {
    if (!isAdmin) return;
    await updateAdminUser(userId, input);
    await load();
  }

  async function saveMyProfile(input: {
    name?: string;
    phone?: string;
    residenceArea?: string;
    examType?: string;
    prepDuration?: string;
    password?: string;
  }) {
    const updated = await updateMyProfile(input);
    refreshUser(updated);
    setProfileUser(updated as AdminUser);
    await load();
  }

  function changePage(key: keyof typeof pages, page: number) {
    setPages((current) => ({ ...current, [key]: page }));
  }


  async function sendCamWarning(userId: string, message: string, type?: string) {
    if (!message.trim()) return;
    await warnStudent({ userId, message: message.trim(), type });
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
          {visibleTabs.map((item) => (
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

        {tab === "profile" && (
          <Profile user={profileUser} branches={branches} onSave={saveMyProfile} />
        )}

        {isAdmin && tab === "overview" && (
          <Overview
            stats={stats}
            users={data.users}
            noticeTitle={noticeTitle}
            noticeContent={noticeContent}
            manualUserId={manualUserId}
            manualMonths={manualMonths}
            manualName={manualName}
            manualReceiptFile={manualReceiptFile}
            savingManualPayment={savingManualPayment}
            onNoticeTitleChange={setNoticeTitle}
            onNoticeContentChange={setNoticeContent}
            onManualUserChange={setManualUserId}
            onManualMonthsChange={setManualMonths}
            onManualNameChange={setManualName}
            onManualReceiptChange={setManualReceiptFile}
            onSaveNotice={saveNotice}
            onSaveManualPayment={saveManualPayment}
          />
        )}

        {isAdmin && tab === "members" && (
          <Members
            users={data.users}
            branches={branches}
            preRegister={preRegister}
            onPreRegisterChange={updatePreRegister}
            onPreRegisterSubmit={savePreRegister}
            staffForm={staffForm}
            onStaffChange={updateStaffForm}
            onStaffSubmit={saveStaff}
            onUserUpdate={saveUserProfile}
            pageMeta={pageMeta.users}
            onPageChange={(page) => changePage("users", page)}
          />
        )}

        {isAdmin && tab === "consultations" && (
          <Consultations
            consultations={data.consultations}
            onConfirm={confirmConsultation}
            onComplete={completeConsultation}
            pageMeta={pageMeta.consultations}
            onPageChange={(page) => changePage("consultations", page)}
          />
        )}

        {isAdmin && tab === "payments" && (
          <Payments
            payments={data.payments}
            users={data.users}
            pageMeta={pageMeta.payments}
            onPageChange={(page) => changePage("payments", page)}
          />
        )}

        {isAdmin && tab === "leaves" && (
          <Leaves
            leaves={data.leaves}
            users={data.users}
            onAction={handleLeave}
            pageMeta={pageMeta.leaves}
            onPageChange={(page) => changePage("leaves", page)}
          />
        )}

        {tab === "chat" && (
          <Chat
            rooms={data.chats}
            onRefresh={load}
            pageMeta={pageMeta.chats}
            onPageChange={(page) => changePage("chats", page)}
          />
        )}

        {tab === "camera" && (
          <Camera
            camSessions={data.camSessions}
            timetable={timetable}
            users={data.users}
            onWarn={sendCamWarning}
          />
        )}
      </div>
    </AppShell>
  );
}
