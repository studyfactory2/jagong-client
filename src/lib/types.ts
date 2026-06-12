import { ConsultationInputType } from "./enums";

export interface Branch {
  id: string;
  name: string;
}

export interface AuthUser {
  userId?: string;
  id?: string;
  name: string;
  role: string;
  branchId?: string;
}

export interface Session {
  token: string;
  user: AuthUser;
}

export interface TimetableSlot {
  id?: string;
  slot: number;
  label: string;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  duration?: number;
  isBreak: boolean;
  messages?: string[];
}

export type ConsultationInput = {
  name: string;
  age: number;
  phone: string;
  examType: string;
  studyPeriod?: string;
  studyPlace?: string;
  fullTime: boolean;
  reason?: string;
  date: string;
  timeSlot: string;
  type: ConsultationInputType;
};

export interface MembershipPlan {
  months: number;
  days: number;
  total: number;
}

export interface MembershipStatus {
  startDate: string | null;
  membershipEnd: string | null;
  daysLeft: number | null;
  active: boolean;
  reEnrollPeriod: boolean;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  planMonths: number;
  amount: number;
  method: string | null;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
  receiptUrl: string | null;
  receiptSignedUrl?: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  pgTxId: string | null;
  refundAmount?: number | null;
  refundCharge?: number | null;
  refundUsedDays?: number | null;
  refundedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutResult {
  paymentId: string;
  amount: number;
  planMonths: number;
}


export type RoleName = "ADMIN" | "STAFF" | "MEMBER" | string;
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
export type ConsultationStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | string;
export type ConsultationTypeName = "PHONE" | "VIDEO" | "QUESTION" | "IMMEDIATE" | string;
export type LeaveTypeName = "FULL" | "MORNING" | "AFTERNOON";
export type LeaveStatusName = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type SpecialLeaveTypeName = "OUTING" | "MOCK_EXAM" | "STUDY";
export type DayOfWeekName = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

export interface AdminUser extends AuthUser {
  id: string;
  userId?: string;
  role: RoleName;
  phone?: string | null;
  age?: number | null;
  examType?: string | null;
  notes?: string | null;
  isActive?: boolean;
  startDate?: string | null;
  membershipEnd?: string | null;
  branch?: Branch;
  createdAt?: string;
}

export interface AdminUsersResult {
  list: AdminUser[];
  total: number;
}

export interface ConsultationRecord {
  id: string;
  name: string;
  age?: number | null;
  phone: string;
  examType?: string | null;
  studyPeriod?: string | null;
  studyPlace?: string | null;
  fullTime?: boolean | null;
  reason?: string | null;
  desiredDate?: string | null;
  timeSlot?: string | null;
  consultType?: ConsultationTypeName | null;
  status: ConsultationStatus;
  adminNotes?: string | null;
  scheduledAt?: string | null;
  agoraRoomId?: string | null;
  createdAt: string;
  feedback?: ConsultationFeedback | null;
}

export interface ConsultationFeedback {
  id: string;
  rating?: number | null;
  comment: string;
  consentAd: boolean;
  createdAt: string;
}

export interface LeaveRecord {
  id: string;
  userId: string;
  date: string;
  leaveType: LeaveTypeName;
  status: LeaveStatusName;
  reason?: string | null;
  createdAt?: string;
  user?: AdminUser;
}

export interface SpecialLeaveRecord {
  id: string;
  userId: string;
  date: string;
  slots: number[];
  reason: string;
  type: SpecialLeaveTypeName;
  isRecurring: boolean;
  isActive: boolean;
  createdBy: string;
  branchId?: string | null;
  createdAt: string;
  user?: AdminUser;
}

export interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  reply?: string | null;
  status?: string;
  createdAt: string;
  updatedAt?: string;
  user?: AdminUser;
}

export interface NoticeRecord {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  createdBy?: string;
}

export interface CamSessionRecord {
  id: string;
  userId: string;
  slot: number;
  date: string;
  joinedAt?: string | null;
  leftAt?: string | null;
  alerts?: unknown;
  user?: AdminUser;
}

export interface MonthlyGoalRecord {
  id: string;
  userId: string;
  month: string;
  goal: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyPlanTaskRecord {
  id: string;
  weeklyPlanId: string;
  dayOfWeek: DayOfWeekName;
  slot: number;
  title: string;
  isDone: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WeeklyPlanRecord {
  id: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  memo?: string | null;
  monthlyGoalId?: string | null;
  tasks: WeeklyPlanTaskRecord[];
  progress?: number;
  createdAt?: string;
  updatedAt?: string;
}
