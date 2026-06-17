import { http } from "./http";
import type {
  CamSessionRecord,
  CamTokenDto,
  CamWarningRecord,
} from "../../lib/types";

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

export async function issueCamToken(input?: {
  branchId?: string;
}): Promise<CamTokenDto> {
  const { data } = await http.post<CamTokenDto>("/cam/token", input ?? {});
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


export async function warnStudent(input: {
  userId: string;
  type?: string;
  message: string;
}): Promise<CamWarningRecord> {
  const { data } = await http.post<CamWarningRecord>("/cam/warn", input);
  return data;
}
