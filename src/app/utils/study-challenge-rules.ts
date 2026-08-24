export const FIRST_FAILURE_ENDS_RULES_VERSION = "2026-08-21-v2";

type StudyChallengeRulesMetadata = Readonly<{
  rewardLabel: string;
  pdfUrl: string | null;
}>;

const STUDY_CHALLENGE_RULES_METADATA: Readonly<
  Record<string, StudyChallengeRulesMetadata>
> = {
  "2026-07-31-v1": {
    rewardLabel: "이용기간 1개월 연장",
    pdfUrl: null,
  },
  [FIRST_FAILURE_ENDS_RULES_VERSION]: {
    rewardLabel: "이용기간 1개월 연장",
    pdfUrl:
      "https://assets.jagongonline.com/policies/jagong-study-challenge-v2-rules-ko.pdf",
  },
};

function studyChallengeRulesMetadata(
  rulesVersion: string | null | undefined,
): StudyChallengeRulesMetadata | null {
  if (!rulesVersion) return null;
  return STUDY_CHALLENGE_RULES_METADATA[rulesVersion] ?? null;
}

export function studyChallengeRewardLabel(
  rulesVersion: string,
): string | null {
  return studyChallengeRulesMetadata(rulesVersion)?.rewardLabel ?? null;
}

export function studyChallengeRulesPdfUrl(
  rulesVersion: string | null | undefined,
): string | null {
  return studyChallengeRulesMetadata(rulesVersion)?.pdfUrl ?? null;
}
