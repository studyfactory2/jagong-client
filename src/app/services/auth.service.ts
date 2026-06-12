import { http } from "./http";
import type { AuthUser } from "../../lib/types";

/** AUTH API **/

export async function login(
  name: string,
  branchId: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const { data } = await http.post<{ token: string; user: AuthUser }>(
    "/users/login",
    { name, branchId, password },
  );
  return data;
}

export async function register(
  name: string,
  branchId: string,
  password: string,
): Promise<{ token?: string; user: AuthUser }> {
  const { data } = await http.post<{ token?: string; user: AuthUser }>(
    "/users/register",
    { name, branchId, password },
  );
  return data;
}

export async function getMe(): Promise<AuthUser> {
  const { data } = await http.get<AuthUser>("/users/me");
  return data;
}
