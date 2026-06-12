import type {
  AdminUser,
  CamSessionRecord,
  ChatMessage,
  ConsultationRecord,
  LeaveRecord,
  PaymentRecord,
} from "../../../lib/types";

export type AdminTabKey =
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
  chats: ChatMessage[];
  camSessions: CamSessionRecord[];
};

export type AdminStats = {
  activeMembers: number;
  pendingConsultations: number;
  paid: number;
  pendingLeaves: number;
  unanswered: number;
  working: number;
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
  { key: "overview", label: "대시보드" },
  { key: "members", label: "회원" },
  { key: "consultations", label: "상담" },
  { key: "payments", label: "결제" },
  { key: "leaves", label: "휴가" },
  { key: "chat", label: "문의" },
  { key: "camera", label: "캠" },
];
