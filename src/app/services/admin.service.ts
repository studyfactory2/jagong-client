import { http } from "./http";
import type { AdminUser, AdminUsersResult } from "../../lib/types";

/** ADMIN USER API **/

export async function getAdminUsers(input?: {
  branchId?: string;
  role?: string;
  text?: string;
  page?: number;
  limit?: number;
}): Promise<AdminUsersResult> {
  const { data } = await http.get<AdminUsersResult>("/users", {
    params: input,
  });
  return data;
}

export async function preRegisterUser(input: {
  consultationId?: string;
  name: string;
  branchId: string;
  phone?: string;
  residenceArea?: string;
  age?: number;
  examType?: string;
  prepDuration?: string;
  notes?: string;
}): Promise<AdminUser> {
  const { data } = await http.post<AdminUser>("/users/pre-register", input);
  return data;
}

export async function updateAdminUser(
  userId: string,
  input: Partial<AdminUser>,
): Promise<AdminUser> {
  const { data } = await http.post<AdminUser>("/users/update/" + userId, input);
  return data;
}


export async function createStaffUser(input: {
  name: string;
  password: string;
  role: "STAFF";
  branchId?: string;
  phone?: string;
}): Promise<AdminUser> {
  const { data } = await http.post<AdminUser>("/users/staff", input);
  return data;
}
