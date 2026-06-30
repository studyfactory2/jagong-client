import { ConsultationInputType } from "./enums";

export interface Branch {
  id: string;
  name: string;
}

export type PolicyKey =
  | "terms"
  | "privacy"
  | "refund"
  | "camera"
  | "operation"
  | "marketing";

export interface PolicyMeta {
  key: PolicyKey;
  title: string;
  summary: string;
  required: boolean;
}

export interface CurrentPolicy {
  version: string;
  pdfUrl: string;
  registration: PolicyMeta[];
  consultation: PolicyMeta[];
  optional: PolicyMeta[];
}

export interface PolicyDocument {
  key: PolicyKey;
  title: string;
  summary: string;
  version: string;
  pdfUrl: string;
  required: {
    registration: boolean;
    consultation: boolean;
  };
  sections: PolicySection[];
}

export interface PolicySection {
  heading: string;
  body: string;
  table?: PolicyTable;
  footer?: string;
}

export interface PolicyTable {
  headers: string[];
  rows: string[][];
}

export interface AuthUser {
  userId?: string;
  id?: string;
  name: string;
  role: string;
  branchId?: string;
  phone?: string | null;
  residenceArea?: string | null;
  age?: number | null;
  examType?: string | null;
  prepDuration?: string | null;
  notes?: string | null;
  isActive?: boolean;
  startDate?: string | null;
  membershipEnd?: string | null;
}

export interface Session {
  token: string;
  user: AuthUser;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> extends PageMeta {
  list: T[];
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
  residenceArea: string;
  examType: string;
  studyPeriod?: string;
  studyPlace?: string;
  fullTime: boolean;
  reason?: string;
  date: string;
  timeSlot: string;
  type: ConsultationInputType;
  policyVersion: string;
  privacyAgreed: boolean;
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
  userId?: string | null;
  consultationId?: string | null;
  planMonths: number;
  amount: number;
  method: string | null;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
  receiptUrl: string | null;
  receiptSignedUrl?: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  pgTxId: string | null;
  depositorName?: string | null;
  paidAt?: string | null;
  adminMemo?: string | null;
  refundAmount?: number | null;
  refundCharge?: number | null;
  refundUsedDays?: number | null;
  refundedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: Pick<AdminUser, "id" | "name" | "phone"> | null;
  consultation?: Pick<ConsultationRecord, "id" | "name" | "phone"> | null;
}

export interface RefundPreview {
  amount: number;
  refundAmount: number;
  refundCharge: number;
  refundUsedDays: number;
}

export interface CheckoutResult {
  paymentId: string;
  amount: number;
  planMonths: number;
}

export interface ConsultationCheckoutResult extends CheckoutResult {
  periodStart: string;
  periodEnd: string;
  consultation: Pick<ConsultationRecord, "id" | "name" | "phone">;
}

export interface ConsultationCheckoutRecord {
  id: string;
  planMonths: number;
  amount: number;
  status: PaymentStatus;
  periodStart: string | null;
  periodEnd: string | null;
  consultation: Pick<
    ConsultationRecord,
    "id" | "name" | "desiredDate" | "timeSlot" | "consultType"
  > & { phoneLast4?: string | null };
}

export interface PublicPaymentResult {
  id: string;
  status: PaymentStatus;
  amount: number;
  planMonths: number;
  periodStart: string | null;
  periodEnd: string | null;
}


export type RoleName = "ADMIN" | "STAFF" | "MEMBER" | string;
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
export type ConsultationStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | string;
export type ConsultationTypeName = "PHONE" | "VIDEO" | "QUESTION" | "IMMEDIATE" | string;
export type LeaveTypeName = "FULL" | "MORNING" | "AFTERNOON";
export type LeaveStatusName = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type SpecialLeaveTypeName = "OUTING" | "MOCK_EXAM" | "STUDY";
export type DayOfWeekName = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export interface AdminUser extends AuthUser {
  id: string;
  userId?: string;
  role: RoleName;
  phone?: string | null;
  residenceArea?: string | null;
  age?: number | null;
  examType?: string | null;
  prepDuration?: string | null;
  notes?: string | null;
  isActive?: boolean;
  startDate?: string | null;
  membershipEnd?: string | null;
  branch?: Branch;
  createdAt?: string;
}

export type AdminUsersResult = PaginatedResult<AdminUser>;

export interface ConsultationRecord {
  id: string;
  name: string;
  age?: number | null;
  phone: string;
  residenceArea?: string | null;
  examType?: string | null;
  studyPeriod?: string | null;
  prepDuration?: string | null;
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
  payments?: PaymentRecord[];
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

export interface ChatRoomSender {
  id: string;
  name: string;
  role: RoleName;
}

export interface ChatRoomMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender?: ChatRoomSender;
}

export interface ChatRoom {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user?: AdminUser;
  messages?: ChatRoomMessage[];
  latestMessage?: ChatRoomMessage | null;
  unreadCount?: number;
}

export interface NoticeRecord {
  id: string;
  title: string;
  body: string;
  level?: "NOTICE" | "IMPORTANT";
  authorId?: string;
  createdAt: string;
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

export type CamAlertStatusName = "OPEN" | "RETURNED" | "ACKNOWLEDGED";

export type CamAlertTypeName =
  | "FACE_MISSING"
  | "CAMERA_OFF"
  | "AWAY"
  | "LOOKING_AWAY"
  | "MULTIPLE_PEOPLE"
  | string;

export interface CamAlertRecord {
  id: string;
  camSessionId: string;
  alertType: CamAlertTypeName;
  status: CamAlertStatusName | string;
  slot?: number | null;
  detectedAt: string;
  duration: number;
  returnedAt?: string | null;
  acknowledgedAt?: string | null;
  acknowledgedById?: string | null;
  createdAt: string;
  camSession?: CamSessionRecord & {
    user?: Pick<AdminUser, "id" | "name" | "branchId"> | null;
  };
}

export interface CamTokenDto {
  token: string;
  url: string;
  room: string;
  identity: string;
  canPublish: boolean;
}

export interface CamRoomMember {
  id: string;
  name: string;
  isWorking: boolean;
  joinedAt?: string | null;
}

export interface CamWarningRecord {
  id: string;
  userId: string;
  adminId?: string;
  type?: string | null;
  message: string;
  createdAt: string;
}

export type AttendanceStatusName = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  slot: number;
  status: AttendanceStatusName | string;
  markedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: Pick<AdminUser, "id" | "name" | "branchId"> | null;
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
