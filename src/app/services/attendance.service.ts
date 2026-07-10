import { http } from "./http";
import type { AttendanceRecord, AttendanceStatusName } from "../../lib/types";

/** ATTENDANCE API **/

export async function getMyAttendance(input?: {
  date?: string;
}): Promise<AttendanceRecord[]> {
  const { data } = await http.get<AttendanceRecord[]>("/attendance/me", {
    params: input,
  });
  return data;
}

export async function getAdminAttendance(input?: {
  date?: string;
  branchId?: string;
  userId?: string;
}): Promise<AttendanceRecord[]> {
  const { data } = await http.get<AttendanceRecord[]>("/attendance", {
    params: input,
  });
  return data;
}

export async function markAttendance(input: {
  userId: string;
  date: string;
  slot: number;
  status: AttendanceStatusName;
  reasonType?: string;
  reason?: string;
}): Promise<AttendanceRecord> {
  const { data } = await http.post<AttendanceRecord>("/attendance/mark", input);
  return data;
}

export async function syncCamAttendance(slot?: number): Promise<void> {
  await http.post("/cam/attendance", slot === undefined ? {} : { slot });
}
