import { http } from "./http";
import type { CamSessionRecord } from "../../lib/types";

/** CAM API **/

export async function getCamSessions(input?: {
  userId?: string;
  date?: string;
  slot?: number;
}): Promise<CamSessionRecord[]> {
  const { data } = await http.get<CamSessionRecord[]>("/cam/sessions", {
    params: input,
  });
  return data;
}

export async function joinCam(slot: number): Promise<CamSessionRecord> {
  const { data } = await http.post<CamSessionRecord>("/cam/join", { slot });
  return data;
}

export async function leaveCam(slot: number): Promise<CamSessionRecord> {
  const { data } = await http.post<CamSessionRecord>("/cam/leave", { slot });
  return data;
}
