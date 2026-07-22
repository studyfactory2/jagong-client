import type {
  AdminUser,
  CamAlertRecord,
  CamSessionRecord,
  ChatRoom,
  ConsultationRecord,
  NoticeRecord,
  PageMeta,
  LeaveRecord,
  PaymentRecord,
} from "../../../lib/types";

export type AdminTabKey =
  | "profile"
  | "overview"
  | "members"
  | "consultations"
  | "payments"
  | "attendance"
  | "chat"
  | "camera";

export type AdminData = {
  users: AdminUser[];
  allMembers: AdminUser[];
  consultations: ConsultationRecord[];
  payments: PaymentRecord[];
  leaves: LeaveRecord[];
  chats: ChatRoom[];
  camSessions: CamSessionRecord[];
  camAlerts: CamAlertRecord[];
  notices: NoticeRecord[];
};

export type AdminPageKey =
  | "users"
  | "consultations"
  | "payments"
  | "leaves"
  | "chats";

export type AdminPageMeta = Record<AdminPageKey, PageMeta>;

export type AdminTabItem = { key: AdminTabKey; label: string };

export type MemberRegistrationTarget = "member" | "staff";

export type AdminStats = {
  activeMembers: number;
  totalMembers: number;
  pendingConsultations: number;
  paid: number;
  pendingLeaves: number;
  unanswered: number;
  working: number;
};

export const emptyAdminStats: AdminStats = {
  activeMembers: 0,
  totalMembers: 0,
  pendingConsultations: 0,
  paid: 0,
  pendingLeaves: 0,
  unanswered: 0,
  working: 0,
};

export const emptyPageMeta: PageMeta = {
  total: 0,
  page: 1,
  limit: 12,
  totalPages: 1,
};

export const emptyAdminPageMeta: AdminPageMeta = {
  users: emptyPageMeta,
  consultations: emptyPageMeta,
  payments: emptyPageMeta,
  leaves: emptyPageMeta,
  chats: emptyPageMeta,
};

export const emptyAdminData: AdminData = {
  users: [],
  allMembers: [],
  consultations: [],
  payments: [],
  leaves: [],
  chats: [],
  camSessions: [],
  camAlerts: [],
  notices: [],
};

// Workspace tabs define every page an administrator can open. Some are reached
// from dashboard actions instead of the primary navigation.
export const adminTabs: AdminTabItem[] = [
  { key: "profile", label: "내 정보" },
  { key: "overview", label: "대시보드" },
  { key: "members", label: "회원" },
  { key: "consultations", label: "상담" },
  { key: "payments", label: "결제" },
  { key: "attendance", label: "출석" },
  { key: "chat", label: "문의" },
  { key: "camera", label: "캠" },
];

export const staffTabs: AdminTabItem[] = [
  { key: "profile", label: "내 정보" },
  { key: "camera", label: "캠" },
  { key: "attendance", label: "출석" },
  { key: "chat", label: "문의" },
];

// Keep the day-to-day navigation intentionally small. Attendance and camera
// stay first because they are the manager's most frequent workflows.
export const adminPrimaryTabs: AdminTabItem[] = [
  { key: "attendance", label: "출석" },
  { key: "camera", label: "캠" },
  { key: "overview", label: "대시보드" },
  { key: "profile", label: "내 정보" },
];

// Staff does not have the administrator dashboard, so inquiry remains their
// third primary workspace while preserving the same compact four-item shell.
export const staffPrimaryTabs: AdminTabItem[] = [
  { key: "attendance", label: "출석" },
  { key: "camera", label: "캠" },
  { key: "chat", label: "문의" },
  { key: "profile", label: "내 정보" },
];
