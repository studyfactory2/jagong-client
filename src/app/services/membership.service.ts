import { http } from "./http";
import type {
  CheckoutResult,
  ConsultationCheckoutRecord,
  ConsultationCheckoutResult,
  MembershipPlan,
  MembershipStatus,
  MembershipGrant,
  PaginatedResult,
  PaymentRecord,
  PaymentStatus,
  PublicPaymentResult,
  RefundPreview,
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

/** PUBLIC CONSULTATION CHECKOUT API **/

export async function getPublicCheckout(
  paymentId: string,
): Promise<ConsultationCheckoutRecord> {
  const { data } = await http.get<ConsultationCheckoutRecord>(
    "/memberships/public/" + paymentId,
  );
  return data;
}

export async function confirmPublicPayment(input: {
  paymentId: string;
  pgKey?: string;
}): Promise<PublicPaymentResult> {
  const { data } = await http.post<PublicPaymentResult>(
    "/memberships/public/confirm",
    input,
  );
  return data;
}

/** ADMIN MEMBERSHIP API **/

export async function createConsultationCheckout(input: {
  consultationId: string;
  planMonths: number;
  startDate: string;
}): Promise<ConsultationCheckoutResult> {
  const { data } = await http.post<ConsultationCheckoutResult>(
    "/memberships/consultations/" + input.consultationId + "/checkout",
    { planMonths: input.planMonths, startDate: input.startDate },
  );
  return data;
}

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
  startDate: string;
  adminMemo?: string;
}): Promise<PaymentRecord> {
  const { data } = await http.post<PaymentRecord>("/memberships/manual", input);
  return data;
}

export async function grantFreeTrial(input: {
  userId: string;
  days: number;
  startDate?: string;
  adminMemo?: string;
}): Promise<MembershipGrant> {
  const { data } = await http.post<MembershipGrant>(
    "/memberships/free-trials",
    input,
  );
  return data;
}

export async function previewRefund(paymentId: string): Promise<RefundPreview> {
  const { data } = await http.get<RefundPreview>(
    "/memberships/" + paymentId + "/refund-preview",
  );
  return data;
}

export async function recordManualRefund(
  paymentId: string,
): Promise<PaymentRecord> {
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
