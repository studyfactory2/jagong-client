import { http } from "./http";
import type {
  JoinStudyChallengeInput,
  JoinStudyChallengeResult,
  MyStudyChallengeStatus,
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
