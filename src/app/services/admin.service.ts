import { http } from "./http";
import type { AdminUser, AdminUsersResult } from "../../lib/types";

/** ADMIN USER API **/

export async function getAdminUsers(branchId?: string): Promise<AdminUsersResult> {
  const { data } = await http.get<AdminUsersResult>("/users", {
    params: branchId ? { branchId } : undefined,
  });
  return data;
}

export async function preRegisterUser(input: {
  consultationId?: string;
  name: string;
  branchId: string;
  phone?: string;
  age?: number;
  examType?: string;
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
