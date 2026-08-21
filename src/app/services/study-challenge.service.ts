import { http } from "./http";
import type {
  AdminStudyChallengeDetail,
  AdminStudyChallengeListResult,
  JoinStudyChallengeInput,
  JoinStudyChallengeResult,
  MyStudyChallengeStatus,
  StudyChallengeStatus,
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
