import type {
  AdminStudyChallengeDetail,
  AdminStudyChallengeDetailWeek,
  AdminStudyChallengeLifecycleEvent,
  AdminStudyChallengeListItem,
  AdminStudyChallengeListResult,
  StudyChallengeStatus,
  StudyChallengeTerminationResult,
} from "../../../../lib/types";

export type ChallengeStatusFilter = "ALL" | StudyChallengeStatus;

export const PAGE_LIMIT = 12;
export const TERMINATION_REASON_MAX_LENGTH = 500;

export const EMPTY_RESULT: AdminStudyChallengeListResult = {
  list: [],
  total: 0,
  page: 1,
  limit: PAGE_LIMIT,
  totalPages: 1,
  generatedAt: "",
};

export const STATUS_OPTIONS: Array<{
  value: ChallengeStatusFilter;
  label: string;
}> = [
  { value: "ALL", label: "전체 상태" },
  { value: "SCHEDULED", label: "참여 예정" },
  { value: "ACTIVE", label: "진행 중" },
  { value: "PASSED", label: "성공" },
  { value: "FAILED", label: "실패" },
  { value: "CANCELLED", label: "취소" },
  { value: "WITHDRAWN", label: "중도 포기" },
];

const TERMINAL_STATUSES = new Set<StudyChallengeStatus>([
  "PASSED",
  "FAILED",
  "CANCELLED",
  "WITHDRAWN",
]);

const challengeDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const challengeDateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateTimeText(value: string | null | undefined): string {
  const date = validDate(value);
  return date ? challengeDateTimeFormatter.format(date) : "-";
}

export function periodText(
  startsAt: string,
  endsAtExclusive: string,
): string {
  const start = validDate(startsAt);
  const exclusiveEnd = validDate(endsAtExclusive);
  if (!start || !exclusiveEnd) return "기간 확인 필요";
  const inclusiveEnd = new Date(exclusiveEnd.getTime() - 1);
  return `${challengeDateFormatter.format(start)} – ${challengeDateFormatter.format(inclusiveEnd)}`;
}

export function durationText(
  seconds: number | null | undefined,
): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "집계 대기";
  }
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

export function targetText(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "목표 확인 필요";
  const hours = seconds / 3600;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}시간`;
}

export function statusLabel(status: StudyChallengeStatus): string {
  if (status === "SCHEDULED") return "참여 예정";
  if (status === "ACTIVE") return "진행 중";
  if (status === "PASSED") return "성공";
  if (status === "FAILED") return "실패";
  if (status === "CANCELLED") return "취소";
  return "중도 포기";
}

export function eligibilityLabel(
  eligibilityKind: AdminStudyChallengeListItem["eligibilityKind"],
): string {
  if (eligibilityKind === "PAYMENT") return "결제 이용권";
  if (eligibilityKind === "REWARD") return "도전 보상 이용권";
  return "자격 출처 확인 필요";
}

export function isTerminalChallengeStatus(
  status: StudyChallengeStatus,
): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function weekStatusLabel(
  challengeStatus: StudyChallengeStatus,
  week: AdminStudyChallengeDetailWeek,
  currentWeekNumber: number | null,
): string {
  if (week.status === "PASSED") return "달성";
  if (week.status === "FAILED") return "미달";
  if (week.status === "SKIPPED") return "미진행";
  if (isTerminalChallengeStatus(challengeStatus)) return "미진행";
  return week.weekNumber === currentWeekNumber ? "진행 중" : "대기";
}

export function weekStudySeconds(
  detail: AdminStudyChallengeDetail,
  week: AdminStudyChallengeDetailWeek,
): number | null {
  if (week.status === "SKIPPED") return null;
  return detail.currentWeekProgress?.weekNumber === week.weekNumber
    ? detail.currentWeekProgress.studySeconds
    : week.studySeconds;
}

function skippedWeekCount(item: AdminStudyChallengeListItem): number {
  return (
    item.weekSummary.skipped ??
    Math.max(
      0,
      item.weekSummary.total -
        item.weekSummary.passed -
        item.weekSummary.failed -
        item.weekSummary.pending,
    )
  );
}

export function displayedUnstartedWeekCount(
  item: AdminStudyChallengeListItem,
): number {
  return (
    skippedWeekCount(item) +
    (isTerminalChallengeStatus(item.status) ? item.weekSummary.pending : 0)
  );
}

export function displayedPendingWeekCount(
  item: AdminStudyChallengeListItem,
): number {
  return isTerminalChallengeStatus(item.status) ? 0 : item.weekSummary.pending;
}

export function lifecycleEventLabel(
  event: AdminStudyChallengeLifecycleEvent,
): string {
  if (event.eventType === "ENROLLMENT_CONFIRMED") return "참여 확정";
  return event.termination?.kind === "WITHDRAWN" ? "중도 포기" : "참여 취소";
}

export function lifecycleSourceLabel(
  source: AdminStudyChallengeLifecycleEvent["source"],
): string {
  if (source === "MEMBER_SELF") return "회원 직접 처리";
  if (source === "ADMIN_ASSISTED") return "관리자 대리 등록";
  if (source === "ADMIN_ACTION") return "관리자 처리";
  return "결제 환불 처리";
}

export function actorRoleLabel(
  role: AdminStudyChallengeLifecycleEvent["actorRole"],
): string {
  if (role === "ADMIN") return "관리자";
  if (role === "STAFF") return "직원";
  if (role === "MEMBER") return "회원";
  return role;
}

export function consentMethodLabel(
  method: NonNullable<
    AdminStudyChallengeLifecycleEvent["consent"]
  >["method"],
): string {
  if (method === "IN_APP") return "앱 직접 동의";
  if (method === "PHONE") return "전화 동의";
  if (method === "IN_PERSON") return "대면 동의";
  if (method === "WRITTEN") return "서면 동의";
  return "동의 방법 확인 필요";
}

export function terminationReasonLabel(reasonCode: string | null): string {
  if (reasonCode === "PAYMENT_REFUND") return "결제 환불";
  if (reasonCode === "ADMIN_ACTION") return "관리자 종료";
  if (reasonCode === "MEMBER_REQUEST") return "회원 요청";
  return reasonCode || "사유 확인 필요";
}

function challengeTerminationWindowEnded(
  challenge: AdminStudyChallengeDetail,
): boolean {
  const generatedAt = validDate(challenge.generatedAt);
  const endsAtExclusive = validDate(challenge.endsAtExclusive);
  return Boolean(
    generatedAt &&
      endsAtExclusive &&
      generatedAt.getTime() >= endsAtExclusive.getTime(),
  );
}

export function canTerminateChallenge(
  challenge: AdminStudyChallengeDetail,
): boolean {
  return (
    (challenge.status === "SCHEDULED" || challenge.status === "ACTIVE") &&
    !challengeTerminationWindowEnded(challenge)
  );
}

export function applyTerminationToListItem(
  challenge: AdminStudyChallengeListItem,
  termination: StudyChallengeTerminationResult,
): AdminStudyChallengeListItem {
  const pendingWeeks = challenge.weekSummary.pending;
  return {
    ...challenge,
    status: termination.status,
    finalizedAt: termination.finalizedAt,
    currentWeekNumber: null,
    weekSummary: {
      ...challenge.weekSummary,
      pending: 0,
      skipped: skippedWeekCount(challenge) + pendingWeeks,
    },
  };
}

export function applyTerminationToDetail(
  challenge: AdminStudyChallengeDetail,
  termination: StudyChallengeTerminationResult,
): AdminStudyChallengeDetail {
  return {
    ...applyTerminationToListItem(challenge, termination),
    weeks: challenge.weeks.map((week) =>
      week.status === "PENDING"
        ? {
            ...week,
            status: "SKIPPED",
            studySeconds: 0,
            finalizedAt: termination.finalizedAt,
          }
        : week,
    ),
    currentWeekProgress: null,
    lifecycleEvents: challenge.lifecycleEvents,
    generatedAt: termination.finalizedAt,
  };
}

export function terminationCompletedMessage(
  status: StudyChallengeTerminationResult["status"],
  memberName: string,
): string {
  return status === "CANCELLED"
    ? `${memberName} 회원의 도전 참여 취소가 처리되었습니다.`
    : `${memberName} 회원의 도전 중도 포기가 처리되었습니다.`;
}

export function observedTerminationMessage(
  status: StudyChallengeTerminationResult["status"],
  memberName: string,
): string {
  return `${memberName} 회원의 도전이 최신 서버 상태에서 ${statusLabel(status)}로 종료된 것을 확인했습니다. 참여·종료 기록에서 처리 경로를 확인해 주세요.`;
}

export function terminationUnavailableMessage(
  challenge: AdminStudyChallengeDetail,
): string {
  if (challengeTerminationWindowEnded(challenge)) {
    return `${challenge.member.name} 회원의 도전 기간이 종료되어 정산을 기다리고 있습니다. 최신 정산 결과를 확인해 주세요.`;
  }
  return `${challenge.member.name} 회원의 도전 상태가 이미 변경되어 최신 내용을 표시합니다.`;
}

export function memberMeta(item: AdminStudyChallengeListItem): string {
  return [item.member.branch?.name, item.member.examType, item.member.phone]
    .filter(Boolean)
    .join(" · ");
}
