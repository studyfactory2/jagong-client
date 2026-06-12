import type {
  AdminUser,
  CamSessionRecord,
  ChatRoom,
  ConsultationRecord,
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
  | "leaves"
  | "chat"
  | "camera";

export type AdminData = {
  users: AdminUser[];
  consultations: ConsultationRecord[];
  payments: PaymentRecord[];
  leaves: LeaveRecord[];
  chats: ChatRoom[];
  camSessions: CamSessionRecord[];
};

export type AdminPageKey = "users" | "consultations" | "payments" | "leaves" | "chats";

export type AdminPageMeta = Record<AdminPageKey, PageMeta>;

export type AdminStats = {
  activeMembers: number;
  pendingConsultations: number;
  paid: number;
  pendingLeaves: number;
  unanswered: number;
  working: number;
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
  consultations: [],
  payments: [],
  leaves: [],
  chats: [],
  camSessions: [],
};

export const adminTabs: Array<{ key: AdminTabKey; label: string }> = [
  { key: "profile", label: "내 정보" },
  { key: "overview", label: "대시보드" },
  { key: "members", label: "회원" },
  { key: "consultations", label: "상담" },
  { key: "payments", label: "결제" },
  { key: "leaves", label: "휴가" },
  { key: "chat", label: "문의" },
  { key: "camera", label: "캠" },
];


export const staffTabs: Array<{ key: AdminTabKey; label: string }> = [
  { key: "profile", label: "내 정보" },
  { key: "camera", label: "캠" },
  { key: "chat", label: "문의" },
];
