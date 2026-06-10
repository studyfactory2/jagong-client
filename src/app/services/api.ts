import { http } from "./http";
import type {
  Branch,
  AuthUser,
  TimetableSlot,
  ConsultationInput,
  MembershipPlan,
  MembershipStatus,
  PaymentRecord,
  CheckoutResult,
} from "../../lib/types";

export async function getBranches(): Promise<Branch[]> {
  const { data } = await http.get<Branch[]>("/branches");
  return data;
}

export async function login(
  name: string,
  branchId: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const { data } = await http.post<{ token: string; user: AuthUser }>(
    "/users/login",
    {
      name,
      branchId,
      password,
    },
  );
  return data;
}

export async function getMe(): Promise<AuthUser> {
  const { data } = await http.get<AuthUser>("/users/me");
  return data;
}

export async function register(
  name: string,
  branchId: string,
  password: string,
): Promise<{ token?: string; user: AuthUser }> {
  const { data } = await http.post<{ token?: string; user: AuthUser }>(
    "/users/register",
    {
      name,
      branchId,
      password,
    },
  );
  return data;
}

export async function createConsultation(
  input: ConsultationInput,
): Promise<void> {
  await http.post("/consultations", input);
}

export async function getTimetable(): Promise<TimetableSlot[]> {
  const { data } = await http.get<TimetableSlot[]>("/timetable");
  return data;
}

export async function getOnlineCount(): Promise<{ count: number }> {
  const { data } = await http.get<{ count: number }>("/users/online-count");
  return data;
}

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
  pgKey: string;
}): Promise<PaymentRecord> {
  const { data } = await http.post<PaymentRecord>("/memberships/confirm", input);
  return data;
}
