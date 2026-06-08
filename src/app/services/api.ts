import { http } from "./http";
import type { Branch, AuthUser, TimetableSlot } from "../../lib/types";

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

export async function getTimetable(): Promise<TimetableSlot[]> {
  const { data } = await http.get<TimetableSlot[]>("/timetable");
  return data;
}
