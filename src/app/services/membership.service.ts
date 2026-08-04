import { http } from "./http";
import type {
  CheckoutResult,
  ConsultationCheckoutRecord,
  ConsultationCheckoutRequest,
  ConsultationCheckoutResult,
  ManualPaymentRequest,
  ManualRefundRequest,
  MembershipPlan,
  MemberPaymentRecord,
  MembershipStatus,
  MembershipGrant,
  PaginatedResult,
  PaymentRecord,
  PaymentStatus,
  PublicPaymentResult,
  RefundPreview,
  ReplaceConsultationCheckoutRequest,
} from "../../lib/types";

/** MEMBER MEMBERSHIP API **/

export async function getMembershipPlans(): Promise<MembershipPlan[]> {
  const { data } = await http.get<MembershipPlan[]>("/memberships/plans");
  const validPlans =
    data.length > 0 &&
    data.every(
      (plan) =>
        Number.isInteger(plan.months) &&
        plan.months > 0 &&
        Number.isInteger(plan.days) &&
        plan.days > 0 &&
        Number.isInteger(plan.total) &&
        plan.total > 0,
    ) &&
    new Set(data.map((plan) => plan.months)).size === data.length;
  if (!validPlans) {
    throw new Error("이용권 가격 정보가 올바르지 않습니다.");
  }
  return [...data].sort((left, right) => left.months - right.months);
}

export async function getMyMembership(): Promise<MembershipStatus> {
  const { data } = await http.get<MembershipStatus>("/memberships/me");
  return data;
}

export async function getMyPayments(): Promise<MemberPaymentRecord[]> {
  const { data } = await http.get<MemberPaymentRecord[]>(
    "/memberships/me/payments",
  );
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
}): Promise<MemberPaymentRecord> {
  const { data } = await http.post<MemberPaymentRecord>(
    "/memberships/confirm",
    input,
  );
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

export async function createConsultationCheckout(
  input: ConsultationCheckoutRequest,
): Promise<ConsultationCheckoutResult> {
  const { consultationId, ...body } = input;
  const { data } = await http.post<ConsultationCheckoutResult>(
    "/memberships/consultations/" + consultationId + "/checkout",
    body,
  );
  return data;
}

export async function replaceConsultationCheckout(
  input: ReplaceConsultationCheckoutRequest,
): Promise<ConsultationCheckoutResult> {
  const { consultationId, ...body } = input;
  const { data } = await http.post<ConsultationCheckoutResult>(
    "/memberships/consultations/" + consultationId + "/checkout/replace",
    body,
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

export async function recordManualPayment(
  input: ManualPaymentRequest,
): Promise<PaymentRecord> {
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
  input: ManualRefundRequest,
): Promise<PaymentRecord> {
  const { data } = await http.post<PaymentRecord>(
    "/memberships/" + paymentId + "/refund",
    input,
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
