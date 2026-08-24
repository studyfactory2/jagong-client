export const FIRST_FAILURE_ENDS_RULES_VERSION = "2026-08-21-v2";

const STUDY_CHALLENGE_REWARD_LABELS: Record<string, string> = {
  "2026-07-31-v1": "이용기간 1개월 연장",
  [FIRST_FAILURE_ENDS_RULES_VERSION]: "이용기간 1개월 연장",
};

export function studyChallengeRewardLabel(
  rulesVersion: string,
): string | null {
  return STUDY_CHALLENGE_REWARD_LABELS[rulesVersion] ?? null;
}
