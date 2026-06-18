import { http } from "./http";
import type {
  CheckoutResult,
  MembershipPlan,
  MembershipStatus,
  PaginatedResult,
  PaymentRecord,
  PaymentStatus,
} from "../../lib/types";

/** MEMBER MEMBERSHIP API **/

export async function getMembershipPlans(): Promise<MembershipPlan[]> {
  const { data } = await http.get<MembershipPlan[]>("/memberships/plans");
  return data;
}

export async function getMyMembership(): Promise<MembershipStatus> {
  const { data } = await http.get<MembershipStatus>("/memberships/me");
  return data;
}

export async function getMyPayments(): Promise<PaymentRecord[]> {
  const { data } = await http.get<PaymentRecord[]>("/memberships/me/payments");
  return data;
}

export async function checkoutMembership(
  planMonths: number,
): Promise<CheckoutResult> {
  const { data } = await http.post<CheckoutResult>("/memberships/checkout", {
    planMonths,
  });
  return data;
}

export async function confirmMembershipPayment(input: {
  paymentId: string;
  pgKey?: string;
}): Promise<PaymentRecord> {
  const { data } = await http.post<PaymentRecord>("/memberships/confirm", input);
  return data;
}

/** ADMIN MEMBERSHIP API **/

export async function getAdminPayments(input?: {
  status?: PaymentStatus;
  userId?: string;
  text?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<PaymentRecord>> {
  const { data } = await http.get<PaginatedResult<PaymentRecord>>("/memberships", {
    params: input,
  });
  return data;
}

export async function recordManualPayment(input: {
  userId: string;
  planMonths: number;
  depositorName: string;
  paidAt: string;
  adminMemo?: string;
}): Promise<PaymentRecord> {
  const { data } = await http.post<PaymentRecord>("/memberships/manual", input);
  return data;
}

export async function previewRefund(paymentId: string): Promise<{
  refundAmount: number;
  refundCharge: number;
  refundUsedDays: number;
}> {
  const { data } = await http.get<{
    refundAmount: number;
    refundCharge: number;
    refundUsedDays: number;
  }>("/memberships/" + paymentId + "/refund-preview");
  return data;
}

export async function refundPayment(paymentId: string): Promise<PaymentRecord> {
  const { data } = await http.post<PaymentRecord>(
    "/memberships/" + paymentId + "/refund",
  );
  return data;
}


export async function attachPaymentReceipt(
  paymentId: string,
  file: File,
): Promise<PaymentRecord> {
  const form = new FormData();
  form.append("file", file);

  const { data } = await http.post<PaymentRecord>(
    "/memberships/" + paymentId + "/receipt",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}
