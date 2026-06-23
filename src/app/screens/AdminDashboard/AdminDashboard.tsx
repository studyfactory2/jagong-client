import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import AppShell from "../../components/ui/AppShell";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import {
  createStaffUser,
  getAdminStats,
  getAdminUsers,
  getAllAdminMembers,
  preRegisterUser,
  updateAdminUser,
} from "../../services/admin.service";
import { getMe, updateMyProfile } from "../../services/auth.service";
import {
  getAdminConsultations,
  updateConsultation,
} from "../../services/consultation.service";
import {
  attachPaymentReceipt,
  createConsultationCheckout,
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
import Attendance from "./Attendance";
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
  emptyAdminStats,
  staffTabs,
  type AdminData,
  type AdminStats,
  type AdminTabKey,
} from "./admin.types";
import "./admin-dashboard.css";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function AdminDashboard() {
  /** STATE **/
  const navigate = useNavigate();
  const { session, refreshUser, logout } = useAuth();
  const { socket } = useSocket();
  const [tab, setTab] = useState<AdminTabKey>("camera");
  const [data, setData] = useState<AdminData>(emptyAdminData);
  const [pageMeta, setPageMeta] = useState(emptyAdminPageMeta);
  const [stats, setStats] = useState<AdminStats>(emptyAdminStats);
  const [pages, setPages] = useState({
    users: 1,
    consultations: 1,
    payments: 1,
    leaves: 1,
    chats: 1,
  });
  const [search, setSearch] = useState({
    users: "",
    consultations: "",
    payments: "",
    leaves: "",
    chats: "",
    camera: "",
  });
  // Camera filters client-side, so it stays instant; server-backed searches
  // read from the debounced value to avoid refetching on every keystroke.
  const debouncedSearch = useDebouncedValue(search, 350);
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
    consultationId: "",
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
  const activeTab: AdminTabKey = visibleTabs.some((item) => item.key === tab)
    ? tab
    : (visibleTabs[0]?.key ?? "camera");

  /** EFFECTS **/
  useEffect(() => {
    load();
  }, [
    allowed,
    isAdmin,
    pages.users,
    pages.consultations,
    pages.payments,
    pages.leaves,
    pages.chats,
    debouncedSearch.users,
    debouncedSearch.consultations,
    debouncedSearch.payments,
    debouncedSearch.leaves,
    debouncedSearch.chats,
  ]);

  useEffect(() => {
    if (!socket || !allowed) return;
    const refreshCamera = () => refreshLiveData();
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
      const [
        usersResult,
        branchData,
        timetableData,
        chatsResult,
        camSessions,
        me,
        allMembers,
        statsResult,
      ] = await Promise.all([
        getAdminUsers({
          page: pages.users,
          limit: 12,
          text: debouncedSearch.users,
        }),
        getBranches(),
        getTimetable(),
        getAdminChatRooms({
          page: pages.chats,
          limit: 12,
          text: debouncedSearch.chats,
        }),
        getCamSessions(),
        getMe(),
        getAllAdminMembers(),
        getAdminStats(),
      ]);

      const [consultations, payments, leaves] = isAdmin
        ? await Promise.all([
            getAdminConsultations({
              page: pages.consultations,
              limit: 10,
              text: debouncedSearch.consultations,
            }),
            getAdminPayments({
              page: pages.payments,
              limit: 10,
              text: debouncedSearch.payments,
            }),
            getAdminLeaves({
              page: pages.leaves,
              limit: 10,
              text: debouncedSearch.leaves,
            }),
          ])
        : [
            { ...emptyAdminPageMeta.consultations, list: [] },
            { ...emptyAdminPageMeta.payments, list: [] },
            { ...emptyAdminPageMeta.leaves, list: [] },
          ];

      setBranches(branchData);
      setTimetable(timetableData);
      setProfileUser(me as AdminUser);
      setStats(statsResult);
      setData({
        users: usersResult.list,
        allMembers,
        consultations: consultations.list ?? [],
        payments: payments.list ?? [],
        leaves: leaves.list ?? [],
        chats: chatsResult.list,
        camSessions,
      });
      setPageMeta({
        users: usersResult,
        consultations: consultations.list
          ? consultations
          : emptyAdminPageMeta.consultations,
        payments: payments.list ? payments : emptyAdminPageMeta.payments,
        leaves: leaves.list ? leaves : emptyAdminPageMeta.leaves,
        chats: chatsResult,
      });
      setManualUserId((current) => current || allMembers[0]?.id || "");
      setPreRegister((current) => ({
        ...current,
        branchId: current.branchId || branchData[0]?.id || "",
      }));
      setStaffForm((current) => ({
        ...current,
        branchId: current.branchId || branchData[0]?.id || "",
      }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "관리자 정보를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function refreshLiveData() {
    if (!allowed) return;
    try {
      const [camSessions, chatsResult, statsResult] = await Promise.all([
        getCamSessions(),
        getAdminChatRooms({
          page: pages.chats,
          limit: 12,
          text: debouncedSearch.chats,
        }),
        getAdminStats(),
      ]);
      setStats(statsResult);
      setData((current) => ({
        ...current,
        camSessions,
        chats: chatsResult.list,
      }));
      setPageMeta((current) => ({ ...current, chats: chatsResult }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "실시간 정보를 갱신하지 못했습니다.",
      );
    }
  }

  async function runAdminAction(action: () => Promise<void>, fallback: string) {
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    }
  }

  async function saveNotice() {
    if (!isAdmin || !noticeTitle.trim() || !noticeContent.trim()) return;
    await runAdminAction(async () => {
      await createNotice({ title: noticeTitle, body: noticeContent });
      setNoticeTitle("");
      setNoticeContent("");
    }, "공지를 등록하지 못했습니다.");
  }

  function updatePreRegister(field: keyof typeof preRegister, value: string) {
    setPreRegister((current) => ({ ...current, [field]: value }));
  }

  async function savePreRegister() {
    if (!isAdmin || !preRegister.name.trim() || !preRegister.branchId) return;
    await runAdminAction(async () => {
      await preRegisterUser({
        consultationId: preRegister.consultationId || undefined,
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
        consultationId: "",
        name: "",
        phone: "",
        residenceArea: "",
        age: "",
        examType: "",
        prepDuration: "",
        notes: "",
      }));
      await load();
    }, "사전등록을 저장하지 못했습니다.");
  }

  async function saveManualPayment() {
    if (!isAdmin || !manualUserId || !manualName.trim() || savingManualPayment)
      return;
    setSavingManualPayment(true);
    try {
      await runAdminAction(async () => {
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
      }, "수동 결제를 등록하지 못했습니다.");
    } finally {
      setSavingManualPayment(false);
    }
  }

  async function createConsultationPaymentLink(input: {
    consultationId: string;
    planMonths: number;
    startDate: string;
  }): Promise<string> {
    if (!isAdmin) return "";
    let checkoutUrl = "";
    await runAdminAction(async () => {
      const checkout = await createConsultationCheckout(input);
      checkoutUrl = window.location.origin + "/checkout/" + checkout.paymentId;
      await load();
    }, "결제링크를 만들지 못했습니다.");
    return checkoutUrl;
  }

  function preparePreRegisterFromConsultation(id: string) {
    const item = data.consultations.find((consultation) => consultation.id === id);
    if (!item) return;
    setPreRegister((current) => ({
      ...current,
      consultationId: item.id,
      name: item.name ?? "",
      phone: item.phone ?? "",
      residenceArea: item.residenceArea ?? "",
      age: item.age ? String(item.age) : "",
      examType: item.examType ?? "",
      prepDuration: item.prepDuration ?? item.studyPeriod ?? "",
      notes: current.notes,
    }));
    setTab("members");
  }

  async function completeConsultation(id: string) {
    if (!isAdmin) return;
    await runAdminAction(async () => {
      await updateConsultation(id, { status: "COMPLETED" });
      await load();
    }, "상담 상태를 변경하지 못했습니다.");
  }

  async function confirmConsultation(
    id: string,
    consultType?: string | null,
    meetingLink?: string,
  ) {
    if (!isAdmin) return;
    await runAdminAction(async () => {
      await updateConsultation(id, {
        status: "CONFIRMED",
        consultType: consultType ?? undefined,
        meetingLink: meetingLink?.trim() || undefined,
      });
      await load();
    }, "상담 상태를 변경하지 못했습니다.");
  }

  async function handleLeave(id: string, action: "approve" | "reject") {
    if (!isAdmin) return;
    await runAdminAction(async () => {
      if (action === "approve") await approveLeave(id);
      else await rejectLeave(id);
      await load();
    }, "휴가 상태를 변경하지 못했습니다.");
  }

  function updateStaffForm(field: keyof typeof staffForm, value: string) {
    setStaffForm((current) => ({ ...current, [field]: value }));
  }

  async function saveStaff() {
    if (!isAdmin || !staffForm.name.trim() || staffForm.password.length !== 4)
      return;
    await runAdminAction(async () => {
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
    }, "직원 등록에 실패했습니다.");
  }

  async function saveUserProfile(
    userId: string,
    input: Partial<(typeof data.users)[number]>,
  ) {
    if (!isAdmin) return;
    await runAdminAction(async () => {
      await updateAdminUser(userId, input);
      await load();
    }, "회원 정보를 저장하지 못했습니다.");
  }

  async function saveMyProfile(input: {
    name?: string;
    phone?: string;
    residenceArea?: string;
    examType?: string;
    prepDuration?: string;
    password?: string;
  }) {
    await runAdminAction(async () => {
      const updated = await updateMyProfile(input);
      refreshUser(updated);
      setProfileUser(updated as AdminUser);
      await load();
    }, "내 정보를 저장하지 못했습니다.");
  }

  function changePage(key: keyof typeof pages, page: number) {
    setPages((current) => ({ ...current, [key]: page }));
  }

  function changeSearch(key: keyof typeof search, value: string) {
    setSearch((current) => ({ ...current, [key]: value }));
    const pageKey = key === "camera" ? null : key;
    if (pageKey && pageKey in pages) {
      setPages((current) => ({ ...current, [pageKey]: 1 }));
    }
  }

  function markChatRoomRead(userId: string) {
    const unread =
      data.chats.find((room) => room.userId === userId)?.unreadCount ?? 0;
    if (!unread) return;
    setData((current) => ({
      ...current,
      chats: current.chats.map((room) =>
        room.userId === userId ? { ...room, unreadCount: 0 } : room,
      ),
    }));
    setStats((current) => ({
      ...current,
      unanswered: Math.max(0, current.unanswered - unread),
    }));
  }

  async function sendCamWarning(
    userId: string,
    message: string,
    type?: string,
  ) {
    if (!message.trim()) return;
    await runAdminAction(async () => {
      await warnStudent({ userId, message: message.trim(), type });
    }, "알림을 전송하지 못했습니다.");
  }

  /** RENDER **/
  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const actions = (
    <>
      <button className="admin-refresh" onClick={load} type="button">
        <RefreshOutlinedIcon /> 새로고침
      </button>
      <button className="admin-logout" onClick={handleLogout} type="button">
        <LogoutOutlinedIcon /> 로그아웃
      </button>
    </>
  );

  if (!allowed) {
    return (
      <AppShell
        title="관리자"
        subtitle="접근 권한이 필요합니다"
        backTo="/admin"
        wide
        actions={actions}
      >
        <section className="admin-empty">
          관리자 또는 스태프 계정으로 로그인해 주세요.
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="관리자 작업실"
      subtitle="회원 · 상담 · 결제 · 휴가 · 캠 상태 관리"
      backTo="/admin"
      wide
      actions={actions}
    >
      <div className="admin">
        <nav className="admin-tabs" aria-label="관리자 메뉴">
          {visibleTabs.map((item) => (
            <button
              className={activeTab === item.key ? "is-active" : ""}
              key={item.key}
              onClick={() => setTab(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {error && <p className="admin-error">{error}</p>}
        {loading && (
          <p className="admin-loading">관리자 데이터를 불러오는 중입니다.</p>
        )}

        {activeTab === "profile" && (
          <Profile
            key={[
              profileUser?.id,
              profileUser?.userId,
              profileUser?.name,
              profileUser?.phone,
              profileUser?.residenceArea,
              profileUser?.examType,
              profileUser?.prepDuration,
            ].join(":")}
            user={profileUser}
            branches={branches}
            onSave={saveMyProfile}
          />
        )}

        {isAdmin && activeTab === "overview" && (
          <Overview
            stats={stats}
            users={data.allMembers}
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

        {isAdmin && activeTab === "members" && (
          <Members
            users={data.users}
            branches={branches}
            searchText={search.users}
            onSearchChange={(value) => changeSearch("users", value)}
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

        {isAdmin && activeTab === "consultations" && (
          <Consultations
            consultations={data.consultations}
            searchText={search.consultations}
            onSearchChange={(value) => changeSearch("consultations", value)}
            onConfirm={confirmConsultation}
            onComplete={completeConsultation}
            onCreateCheckout={createConsultationPaymentLink}
            onPreparePreRegister={preparePreRegisterFromConsultation}
            pageMeta={pageMeta.consultations}
            onPageChange={(page) => changePage("consultations", page)}
          />
        )}

        {isAdmin && activeTab === "payments" && (
          <Payments
            payments={data.payments}
            users={data.allMembers}
            searchText={search.payments}
            onSearchChange={(value) => changeSearch("payments", value)}
            pageMeta={pageMeta.payments}
            onPageChange={(page) => changePage("payments", page)}
          />
        )}

        {isAdmin && activeTab === "leaves" && (
          <Leaves
            leaves={data.leaves}
            users={data.allMembers}
            searchText={search.leaves}
            onSearchChange={(value) => changeSearch("leaves", value)}
            onAction={handleLeave}
            pageMeta={pageMeta.leaves}
            onPageChange={(page) => changePage("leaves", page)}
          />
        )}

        {activeTab === "attendance" && (
          <Attendance users={data.allMembers} timetable={timetable} />
        )}

        {activeTab === "chat" && (
          <Chat
            rooms={data.chats}
            searchText={search.chats}
            onSearchChange={(value) => changeSearch("chats", value)}
            onRoomRead={markChatRoomRead}
            onRefresh={refreshLiveData}
            pageMeta={pageMeta.chats}
            onPageChange={(page) => changePage("chats", page)}
          />
        )}

        {activeTab === "camera" && (
          <Camera
            camSessions={data.camSessions}
            timetable={timetable}
            users={data.allMembers}
            searchText={search.camera}
            onSearchChange={(value) => changeSearch("camera", value)}
            onWarn={sendCamWarning}
          />
        )}
      </div>
    </AppShell>
  );
}
