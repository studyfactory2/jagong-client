import { http } from "./http";
import type {
  CamAlertRecord,
  CamRoomMember,
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
  preview?: boolean;
}): Promise<CamTokenDto> {
  const { data } = await http.post<CamTokenDto>("/cam/token", input ?? {});
  return data;
}

export async function getCamRoomMembers(): Promise<CamRoomMember[]> {
  const { data } = await http.get<CamRoomMember[]>("/cam/room-members");
  return data;
}

export async function joinCam(slot?: number): Promise<CamSessionRecord> {
  const { data } = await http.post<CamSessionRecord>(
    "/cam/join",
    slot === undefined ? {} : { slot },
  );
  return data;
}

export async function leaveCam(slot?: number): Promise<CamSessionRecord> {
  const { data } = await http.post<CamSessionRecord>(
    "/cam/leave",
    slot === undefined ? {} : { slot },
  );
  return data;
}

export async function logCamAlert(input: {
  slot?: number;
  alertType: string;
  duration?: number;
}): Promise<CamAlertRecord> {
  const { data } = await http.post<CamAlertRecord>("/cam/alert", input);
  return data;
}

export async function resolveCamAlert(input?: {
  alertType?: string;
}): Promise<CamAlertRecord> {
  const { data } = await http.post<CamAlertRecord>(
    "/cam/alert/resolve",
    input ?? {},
  );
  return data;
}

export async function getActiveCamAlerts(input?: {
  date?: string;
  branchId?: string;
}): Promise<CamAlertRecord[]> {
  const { data } = await http.get<CamAlertRecord[]>("/cam/alerts", {
    params: input,
  });
  return data;
}

export async function acknowledgeCamAlert(
  id: string,
): Promise<CamAlertRecord> {
  const { data } = await http.post<CamAlertRecord>(`/cam/alerts/${id}/ack`);
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
