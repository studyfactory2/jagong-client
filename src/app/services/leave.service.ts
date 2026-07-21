import { http } from "./http";
import type {
  FixedLeaveExceptionRecord,
  FixedLeaveRecord,
  LeaveAttendanceCoverage,
  LeaveRecord,
  MemberLeaveCalendar,
  PaginatedResult,
  SpecialLeaveRecord,
} from "../../lib/types";

/** MEMBER LEAVE API **/

export async function getLeaveCalendar(month: string): Promise<{
  month: string;
  leaves: LeaveRecord[];
  specialLeaves: SpecialLeaveRecord[];
}> {
  const { data } = await http.get<{
    month: string;
    leaves: LeaveRecord[];
    specialLeaves: SpecialLeaveRecord[];
  }>("/leaves/calendar", { params: { month } });
  return data;
}

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

export async function getLeaveAttendanceCoverage(input: {
  date: string;
  branchId?: string;
}): Promise<LeaveAttendanceCoverage> {
  const { data } = await http.get<LeaveAttendanceCoverage>(
    "/leaves/attendance-coverage",
    { params: input },
  );
  return data;
}

export async function getMemberLeaveCalendar(input: {
  userId: string;
  month: string;
}): Promise<MemberLeaveCalendar> {
  const { data } = await http.get<MemberLeaveCalendar>(
    "/leaves/member-calendar",
    { params: input },
  );
  return data;
}

export async function cancelLeaveFromAttendance(id: string): Promise<LeaveRecord> {
  const { data } = await http.post<LeaveRecord>(
    "/leaves/attendance/cancel/" + id,
  );
  return data;
}

export async function createFixedLeave(input: {
  userId: string;
  dayOfWeek: FixedLeaveRecord["dayOfWeek"];
  slots: number[];
  reason: string;
  startDate?: string;
  endDate?: string;
}): Promise<FixedLeaveRecord> {
  const { data } = await http.post<FixedLeaveRecord>("/leaves/fixed", input);
  return data;
}

export async function getFixedLeaves(input?: {
  userId?: string;
  branchId?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<FixedLeaveRecord>> {
  const { data } = await http.get<PaginatedResult<FixedLeaveRecord>>(
    "/leaves/fixed",
    { params: input },
  );
  return data;
}

export async function cancelFixedLeave(id: string): Promise<FixedLeaveRecord> {
  const { data } = await http.post<FixedLeaveRecord>(
    "/leaves/fixed/cancel/" + id,
  );
  return data;
}

export async function cancelFixedLeaveOccurrence(
  id: string,
  date: string,
): Promise<FixedLeaveExceptionRecord> {
  const { data } = await http.post<FixedLeaveExceptionRecord>(
    "/leaves/fixed/" + id + "/exceptions",
    { date },
  );
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
