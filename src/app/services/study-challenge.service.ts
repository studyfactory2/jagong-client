import { http } from "./http";
import type {
  AdminEnrollStudyChallengeInput,
  AdminStudyChallengeEnrollmentPreview,
  AdminStudyChallengeDetail,
  AdminStudyChallengeListResult,
  JoinStudyChallengeInput,
  JoinStudyChallengeResult,
  MyStudyChallengeStatus,
  StudyChallengeTerminationResult,
  StudyChallengeStatus,
  TerminateAdminStudyChallengeInput,
  TerminateMyStudyChallengeInput,
} from "../../lib/types";

/** STUDY CHALLENGE API **/

export async function getMyStudyChallenge(): Promise<MyStudyChallengeStatus> {
  const { data } = await http.get<MyStudyChallengeStatus>(
    "/study-challenges/me",
  );
  return data;
}

export async function joinStudyChallenge(
  input: JoinStudyChallengeInput,
): Promise<JoinStudyChallengeResult> {
  const { data } = await http.post<JoinStudyChallengeResult>(
    "/study-challenges/join",
    input,
  );
  return data;
}

export async function terminateMyStudyChallenge(
  challengeId: string,
  input: TerminateMyStudyChallengeInput,
): Promise<StudyChallengeTerminationResult> {
  const { data } = await http.post<StudyChallengeTerminationResult>(
    `/study-challenges/${encodeURIComponent(challengeId)}/terminate`,
    input,
  );
  return data;
}

export type AdminStudyChallengeQuery = {
  page: number;
  limit: number;
  text?: string;
  status?: StudyChallengeStatus;
  branchId?: string;
};

export async function getAdminStudyChallenges(
  params: AdminStudyChallengeQuery,
): Promise<AdminStudyChallengeListResult> {
  const { data } = await http.get<AdminStudyChallengeListResult>(
    "/study-challenges/admin",
    { params },
  );
  return data;
}

export async function getAdminStudyChallenge(
  challengeId: string,
): Promise<AdminStudyChallengeDetail> {
  const { data } = await http.get<AdminStudyChallengeDetail>(
    `/study-challenges/admin/${encodeURIComponent(challengeId)}`,
  );
  return data;
}

export async function getAdminStudyChallengeEnrollment(
  userId: string,
): Promise<AdminStudyChallengeEnrollmentPreview> {
  const { data } = await http.get<AdminStudyChallengeEnrollmentPreview>(
    `/study-challenges/admin/enrollments/${encodeURIComponent(userId)}`,
  );
  return data;
}

export async function enrollAdminStudyChallenge(
  userId: string,
  input: AdminEnrollStudyChallengeInput,
): Promise<JoinStudyChallengeResult> {
  const { data } = await http.post<JoinStudyChallengeResult>(
    `/study-challenges/admin/enrollments/${encodeURIComponent(userId)}`,
    input,
  );
  return data;
}

export async function terminateAdminStudyChallenge(
  challengeId: string,
  input: TerminateAdminStudyChallengeInput,
): Promise<StudyChallengeTerminationResult> {
  const { data } = await http.post<StudyChallengeTerminationResult>(
    `/study-challenges/admin/${encodeURIComponent(challengeId)}/terminate`,
    input,
  );
  return data;
}
