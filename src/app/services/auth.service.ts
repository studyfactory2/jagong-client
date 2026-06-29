import { http } from "./http";
import type { AuthUser } from "../../lib/types";
import { POLICY_VERSION } from "../../lib/config";

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
  policyAgreed: boolean,
): Promise<{ token?: string; user: AuthUser }> {
  const { data } = await http.post<{ token?: string; user: AuthUser }>(
    "/users/register",
    {
      name,
      branchId,
      password,
      policyVersion: POLICY_VERSION,
      termsAgreed: policyAgreed,
      privacyAgreed: policyAgreed,
      refundAgreed: policyAgreed,
      cameraAgreed: policyAgreed,
      operationAgreed: policyAgreed,
      marketingAgreed: false,
    },
  );
  return data;
}

export async function getMe(): Promise<AuthUser> {
  const { data } = await http.get<AuthUser>("/users/me");
  return data;
}

export async function updateMyProfile(input: {
  name?: string;
  phone?: string;
  residenceArea?: string;
  examType?: string;
  prepDuration?: string;
  password?: string;
}): Promise<AuthUser> {
  const { data } = await http.post<AuthUser>("/users/update-me", input);
  return data;
}
