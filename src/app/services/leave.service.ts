import { http } from "./http";
import type { LeaveRecord, PaginatedResult, SpecialLeaveRecord } from "../../lib/types";

/** MEMBER LEAVE API **/

export async function getMyLeaves(): Promise<LeaveRecord[]> {
  const { data } = await http.get<LeaveRecord[]>("/leaves/me");
  return data;
}

export async function requestLeave(input: {
  date: string;
  leaveType: "FULL" | "MORNING" | "AFTERNOON";
  reason?: string;
}): Promise<LeaveRecord> {
  const { data } = await http.post<LeaveRecord>("/leaves", input);
  return data;
}

export async function cancelLeave(id: string): Promise<LeaveRecord> {
  const { data } = await http.post<LeaveRecord>("/leaves/cancel/" + id);
  return data;
}

/** ADMIN LEAVE API **/

export async function getAdminLeaves(input?: {
  status?: string;
  branchId?: string;
  date?: string;
  text?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<LeaveRecord>> {
  const { data } = await http.get<PaginatedResult<LeaveRecord>>("/leaves", { params: input });
  return data;
}

export async function approveLeave(id: string): Promise<LeaveRecord> {
  const { data } = await http.post<LeaveRecord>("/leaves/approve/" + id);
  return data;
}

export async function rejectLeave(id: string): Promise<LeaveRecord> {
  const { data } = await http.post<LeaveRecord>("/leaves/reject/" + id);
  return data;
}

export async function getSpecialLeaves(input?: {
  userId?: string;
  month?: string;
  branchId?: string;
}): Promise<SpecialLeaveRecord[]> {
  const { data } = await http.get<SpecialLeaveRecord[]>("/leaves/special", {
    params: input,
  });
  return data;
}
