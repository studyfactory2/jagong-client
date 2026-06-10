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
