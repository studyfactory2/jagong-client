import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  getMyStudyChallenge,
  joinStudyChallenge,
  terminateMyStudyChallenge,
} from "../../services/study-challenge.service";
import type {
  MyStudyChallengeStatus,
  StudyChallenge,
  StudyChallengeRules,
  StudyChallengeStatus,
  StudyChallengeTerminationResult,
  StudyChallengeWeek,
  StudyStatisticsWindow,
} from "../../../lib/types";
import {
  FIRST_FAILURE_ENDS_RULES_VERSION,
  studyChallengeRewardLabel,
  studyChallengeRulesPdfUrl,
} from "../../utils/study-challenge-rules";

type StudyChallengePanelProps = {
  refreshToken: number;
};

type ChallengeAgreementSnapshot = {
  joinContractVersion: MyStudyChallengeStatus["joinContractVersion"];
  rules: StudyChallengeRules;
  nextChallenge: StudyStatisticsWindow;
  rewardLabel: string;
  signature: string;
};

const REFRESH_INTERVAL_MS = 60000;
const CHALLENGE_WINDOW_CHANGED_MESSAGE =
  "도전 기간이 변경되었습니다. 최신 기간을 다시 확인하고 동의해 주세요.";

const challengeDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | null | undefined): string {
  const date = validDate(value);
  return date ? challengeDateFormatter.format(date) : "날짜 확인 중";
}

function formatPeriod(
  startsAt: string | null | undefined,
  endsAtExclusive: string | null | undefined,
): string {
  const start = validDate(startsAt);
  const exclusiveEnd = validDate(endsAtExclusive);
  if (!start || !exclusiveEnd) return "도전 기간 확인 중";

  const inclusiveEnd = new Date(exclusiveEnd.getTime() - 1);
  return `${challengeDateFormatter.format(start)} – ${challengeDateFormatter.format(inclusiveEnd)}`;
}

function formatTarget(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "목표 확인 중";
  const hours = seconds / 3600;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}시간`;
}

function formatProgress(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "예정";
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

function challengeStatusLabel(status: StudyChallengeStatus): string {
  if (status === "SCHEDULED") return "참여 확정";
  if (status === "ACTIVE") return "도전 진행 중";
  if (status === "PASSED") return "도전 성공";
  if (status === "FAILED") return "도전 미달성";
  if (status === "CANCELLED") return "도전 취소";
  return "도전 중도 포기";
}

function weekLabel(
  week: StudyChallengeWeek,
  challengeStatus: StudyChallengeStatus,
): string {
  if (week.status === "PASSED") return "달성";
  if (week.status === "FAILED") return "미달성";
  if (week.status === "SKIPPED") return "미진행";
  if (
    challengeStatus === "PASSED" ||
    challengeStatus === "FAILED" ||
    challengeStatus === "CANCELLED" ||
    challengeStatus === "WITHDRAWN"
  ) {
    return "미진행";
  }
  return formatProgress(week.studySeconds);
}

function isCurrentWeek(week: StudyChallengeWeek, referenceAt: Date): boolean {
  const startsAt = validDate(week.startsAt);
  const endsAt = validDate(week.endsAtExclusive);
  return Boolean(
    startsAt && endsAt && startsAt <= referenceAt && referenceAt < endsAt,
  );
}

function resultLabel(challenge: StudyChallenge): string {
  if (challenge.status === "PASSED") return "지난 도전 성공";
  if (challenge.status === "CANCELLED") return "지난 도전 취소";
  if (challenge.status === "WITHDRAWN") return "지난 도전 중도 포기";
  return "지난 도전 결과";
}

function terminationResultMessage(challenge: StudyChallenge): string | null {
  if (challenge.status === "CANCELLED") {
    return "도전 참여가 취소되었습니다.";
  }
  if (challenge.status === "WITHDRAWN") {
    return "도전 진행 중 중도 포기로 종료되었습니다.";
  }
  return null;
}

function earlyFailureResultMessage(challenge: StudyChallenge): string | null {
  if (
    challenge.status !== "FAILED" ||
    challenge.rulesVersion !== FIRST_FAILURE_ENDS_RULES_VERSION
  ) {
    return null;
  }
  const failedWeek = challenge.weeks.find((week) => week.status === "FAILED");
  if (!failedWeek || !challenge.weeks.some((week) => week.status === "SKIPPED")) {
    return null;
  }
  return `${failedWeek.weekNumber}주차 목표 미달성으로 도전이 조기 종료되었습니다. 이후 주차는 미진행 처리되었습니다.`;
}

function agreementSignature(
  rules: StudyChallengeRules,
  nextChallenge: StudyStatisticsWindow | null | undefined,
  joinContractVersion: MyStudyChallengeStatus["joinContractVersion"],
): string {
  return [
    typeof joinContractVersion === "number" &&
    Number.isFinite(joinContractVersion)
      ? joinContractVersion
      : 1,
    rules.version,
    rules.requiredWeeks,
    rules.weeklyTargetSeconds,
    nextChallenge?.startsAt ?? "",
    nextChallenge?.endsAtExclusive ?? "",
  ].join(":");
}

function usesExactWindowJoinContract(
  joinContractVersion: MyStudyChallengeStatus["joinContractVersion"],
): boolean {
  return (
    typeof joinContractVersion === "number" &&
    Number.isFinite(joinContractVersion) &&
    joinContractVersion >= 2
  );
}

function isSubmittableChallengeWindow(
  window: StudyStatisticsWindow | null | undefined,
  referenceAt: number = Date.now(),
): boolean {
  if (!window) return false;
  const startsAt = validDate(window.startsAt);
  const endsAtExclusive = validDate(window.endsAtExclusive);
  return Boolean(
    startsAt &&
      endsAtExclusive &&
      startsAt.getTime() > referenceAt &&
      startsAt.getTime() < endsAtExclusive.getTime(),
  );
}

function canTerminateChallenge(challenge: StudyChallenge): boolean {
  return (
    Boolean(challenge.confirmedAt) &&
    (challenge.status === "SCHEDULED" || challenge.status === "ACTIVE")
  );
}

function applyTerminationResult(
  challenge: StudyChallenge,
  result: StudyChallengeTerminationResult,
): StudyChallenge {
  return {
    ...challenge,
    status: result.status,
    finalizedAt: result.finalizedAt,
    weeks: challenge.weeks.map((week) =>
      week.status === "PENDING"
        ? {
            ...week,
            status: "SKIPPED",
            studySeconds: 0,
            finalizedAt: result.finalizedAt,
          }
        : week,
    ),
  };
}

function terminationCompletedMessage(
  status: StudyChallengeTerminationResult["status"],
): string {
  return status === "CANCELLED"
    ? "도전 참여 취소가 처리되었습니다."
    : "도전 중도 포기가 처리되었습니다.";
}

export default function StudyChallengePanel({
  refreshToken,
}: StudyChallengePanelProps) {
  const titleId = useId();
  const descriptionId = useId();
  const requestRef = useRef(0);
  const terminationSnapshotRef = useRef<StudyChallenge | null>(null);
  const agreementRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const completionNoticeRef = useRef<HTMLParagraphElement>(null);
  const [data, setData] = useState<MyStudyChallengeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [completionNotice, setCompletionNotice] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [agreementSnapshot, setAgreementSnapshot] =
    useState<ChallengeAgreementSnapshot | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [joining, setJoining] = useState(false);
  const [terminationSnapshot, setTerminationSnapshot] =
    useState<StudyChallenge | null>(null);
  const [terminationConfirmed, setTerminationConfirmed] = useState(false);
  const [terminationError, setTerminationError] = useState("");
  const [terminating, setTerminating] = useState(false);
  const visibleAgreementSnapshot =
    dialogOpen &&
    agreementSnapshot &&
    data?.canJoin &&
    agreementSignature(
      data.joinRules,
      data.nextChallenge,
      data.joinContractVersion,
    ) ===
      agreementSnapshot.signature
      ? agreementSnapshot
      : null;
  const visibleTerminationSnapshot =
    terminationSnapshot &&
    data?.isParticipating &&
    data.currentChallenge &&
    data.currentChallenge.id === terminationSnapshot.id &&
    canTerminateChallenge(data.currentChallenge)
      ? terminationSnapshot
      : null;
  const visibleDialogSnapshot =
    visibleAgreementSnapshot ?? visibleTerminationSnapshot;

  const loadChallenge = useCallback(async (showLoading: boolean) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    if (showLoading) setLoading(true);

    try {
      const next = await getMyStudyChallenge();
      if (requestRef.current !== requestId) return undefined;
      setData(next);
      setLoadError("");
      const pendingTermination = terminationSnapshotRef.current;
      if (pendingTermination) {
        const currentChallenge = next.currentChallenge;
        const stillTerminable = Boolean(
          next.isParticipating &&
            currentChallenge?.id === pendingTermination.id &&
            canTerminateChallenge(currentChallenge),
        );
        if (!stillTerminable) {
          const latestResult = next.latestResult;
          const terminationStatus =
            latestResult?.id === pendingTermination.id &&
            (latestResult.status === "CANCELLED" ||
              latestResult.status === "WITHDRAWN")
              ? latestResult.status
              : null;
          terminationSnapshotRef.current = null;
          setTerminationSnapshot(null);
          setTerminationConfirmed(false);
          setTerminationError("");
          setCompletionNotice(
            terminationStatus
              ? terminationCompletedMessage(terminationStatus)
              : "",
          );
          setActionNotice(
            terminationStatus
              ? ""
              : "도전 상태가 이미 변경되어 최신 내용을 표시합니다.",
          );
        }
      }
      return next;
    } catch (error) {
      if (requestRef.current !== requestId) return undefined;
      setLoadError(
        error instanceof Error
          ? error.message
          : "공부 도전 정보를 불러오지 못했습니다.",
      );
      return null;
    } finally {
      if (requestRef.current === requestId && showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void loadChallenge(true), 0);
    const refreshTimer = window.setInterval(
      () => void loadChallenge(false),
      REFRESH_INTERVAL_MS,
    );

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
      requestRef.current += 1;
    };
  }, [loadChallenge, refreshToken]);

  useEffect(() => {
    if (!visibleDialogSnapshot) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      agreementRef.current?.focus();
    });
    document.body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [visibleDialogSnapshot]);

  useEffect(() => {
    if (!visibleDialogSnapshot || (!joining && !terminating)) return;
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [joining, terminating, visibleDialogSnapshot]);

  useEffect(() => {
    if (!completionNotice) return;
    const focusFrame = window.requestAnimationFrame(() => {
      completionNoticeRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [completionNotice]);

  const openDialog = () => {
    if (!data?.canJoin || !isSubmittableChallengeWindow(data.nextChallenge)) {
      return;
    }
    const rewardLabel = studyChallengeRewardLabel(data.joinRules.version);
    if (!rewardLabel) return;

    terminationSnapshotRef.current = null;
    setTerminationSnapshot(null);
    setTerminationConfirmed(false);
    setTerminationError("");
    setAgreementSnapshot({
      joinContractVersion: data.joinContractVersion,
      rules: data.joinRules,
      nextChallenge: data.nextChallenge,
      rewardLabel,
      signature: agreementSignature(
        data.joinRules,
        data.nextChallenge,
        data.joinContractVersion,
      ),
    });
    setAgreed(false);
    setActionError("");
    setActionNotice("");
    setCompletionNotice("");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (joining) return;
    setDialogOpen(false);
    setAgreementSnapshot(null);
    setAgreed(false);
    setActionError("");
  };

  const openTerminationDialog = (challenge: StudyChallenge) => {
    if (!canTerminateChallenge(challenge)) return;

    setDialogOpen(false);
    setAgreementSnapshot(null);
    setAgreed(false);
    setActionError("");
    setActionNotice("");
    setCompletionNotice("");
    terminationSnapshotRef.current = challenge;
    setTerminationSnapshot(challenge);
    setTerminationConfirmed(false);
    setTerminationError("");
  };

  const resetTerminationDialog = () => {
    terminationSnapshotRef.current = null;
    setTerminationSnapshot(null);
    setTerminationConfirmed(false);
    setTerminationError("");
  };

  const closeTerminationDialog = () => {
    if (terminating) return;
    resetTerminationDialog();
  };

  const closeActiveDialog = () => {
    if (visibleTerminationSnapshot) {
      closeTerminationDialog();
      return;
    }
    closeDialog();
  };

  const handleDialogClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeActiveDialog();
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeActiveDialog();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const activeElement = document.activeElement;
    const dialogHasFocus = activeElement === dialogRef.current;
    if (
      event.shiftKey &&
      (dialogHasFocus ||
        activeElement === first ||
        !dialogRef.current?.contains(activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (dialogHasFocus ||
        activeElement === last ||
        !dialogRef.current?.contains(activeElement))
    ) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleJoin = async () => {
    if (!data?.canJoin || !agreementSnapshot || !agreed || joining) return;
    const latestSignature = agreementSignature(
      data.joinRules,
      data.nextChallenge,
      data.joinContractVersion,
    );
    if (
      latestSignature !== agreementSnapshot.signature ||
      !isSubmittableChallengeWindow(agreementSnapshot.nextChallenge)
    ) {
      setDialogOpen(false);
      setAgreementSnapshot(null);
      setAgreed(false);
      setActionError("");
      setActionNotice(CHALLENGE_WINDOW_CHANGED_MESSAGE);
      void loadChallenge(false);
      return;
    }

    setJoining(true);
    setActionError("");
    try {
      const result = await joinStudyChallenge(
        usesExactWindowJoinContract(agreementSnapshot.joinContractVersion)
          ? {
              acceptedRules: true,
              rulesVersion: agreementSnapshot.rules.version,
              startsAt: agreementSnapshot.nextChallenge.startsAt,
              endsAtExclusive:
                agreementSnapshot.nextChallenge.endsAtExclusive,
            }
          : {
              acceptedRules: true,
              rulesVersion: agreementSnapshot.rules.version,
            },
      );
      setData((current) =>
        current
          ? {
              ...current,
              acceptedRules: result.acceptedRules,
              canJoin: false,
              currentChallenge: result.challenge,
              isParticipating: true,
              unavailableReason: null,
            }
          : current,
      );
      setDialogOpen(false);
      setAgreementSnapshot(null);
      setAgreed(false);
      setActionNotice("");
      void loadChallenge(false);
    } catch (error) {
      const originalError =
        error instanceof Error
          ? error.message
          : "공부 도전 참여를 확정하지 못했습니다.";
      setAgreed(false);

      const refreshed = await loadChallenge(false);
      if (refreshed === undefined) return;
      if (refreshed === null) {
        setActionError(originalError);
        return;
      }

      if (refreshed.isParticipating && refreshed.currentChallenge?.confirmedAt) {
        setDialogOpen(false);
        setAgreementSnapshot(null);
        setActionError("");
        setActionNotice("");
        return;
      }

      const refreshedSignature = agreementSignature(
        refreshed.joinRules,
        refreshed.nextChallenge,
        refreshed.joinContractVersion,
      );
      if (
        refreshedSignature !== agreementSnapshot.signature ||
        !isSubmittableChallengeWindow(refreshed.nextChallenge)
      ) {
        setDialogOpen(false);
        setAgreementSnapshot(null);
        setActionError("");
        setActionNotice(CHALLENGE_WINDOW_CHANGED_MESSAGE);
        return;
      }

      if (!refreshed.canJoin) {
        setDialogOpen(false);
        setAgreementSnapshot(null);
        setActionError("");
        setActionNotice(refreshed.unavailableReason ?? originalError);
        return;
      }

      setActionError(originalError);
    } finally {
      setJoining(false);
    }
  };

  const handleTerminate = async () => {
    const snapshot = terminationSnapshot;
    if (!snapshot || !terminationConfirmed || terminating) return;

    setTerminating(true);
    setTerminationError("");
    try {
      const result = await terminateMyStudyChallenge(snapshot.id, {
        confirmedTermination: true,
      });
      setData((current) => {
        if (!current || current.currentChallenge?.id !== result.challengeId) {
          return current;
        }
        const terminatedChallenge = applyTerminationResult(
          current.currentChallenge,
          result,
        );
        return {
          ...current,
          isParticipating: false,
          canJoin: false,
          unavailableReason:
            "종료한 도전의 기존 4주 기간이 끝난 뒤 다시 참여할 수 있습니다.",
          currentChallenge: null,
          latestResult: terminatedChallenge,
        };
      });
      resetTerminationDialog();
      setActionNotice("");
      setCompletionNotice(terminationCompletedMessage(result.status));
      void loadChallenge(false);
    } catch (error) {
      const originalError =
        error instanceof Error
          ? error.message
          : "공부 도전을 종료하지 못했습니다.";
      setTerminationConfirmed(false);
      setTerminationError(originalError);

      const refreshed = await loadChallenge(false);
      if (refreshed === undefined || refreshed === null) return;

      const latestResult = refreshed.latestResult;
      if (
        latestResult?.id === snapshot.id &&
        (latestResult.status === "CANCELLED" ||
          latestResult.status === "WITHDRAWN")
      ) {
        resetTerminationDialog();
        setActionNotice("");
        setCompletionNotice(
          terminationCompletedMessage(latestResult.status),
        );
        return;
      }

      const refreshedChallenge = refreshed.currentChallenge;
      if (
        !refreshed.isParticipating ||
        !refreshedChallenge ||
        refreshedChallenge.id !== snapshot.id ||
        !canTerminateChallenge(refreshedChallenge)
      ) {
        resetTerminationDialog();
        setCompletionNotice("");
        setActionNotice(
          "도전 상태가 이미 변경되어 최신 내용을 표시합니다.",
        );
      }
    } finally {
      setTerminating(false);
    }
  };

  if (!data && loading) {
    return (
      <section aria-busy="true" className="study-records-challenge is-loading">
        <span className="study-records-challenge-icon" aria-hidden="true">
          <EmojiEventsOutlinedIcon />
        </span>
        <div>
          <strong>4주 공부 도전</strong>
          <p>참여 가능 여부와 도전 규칙을 확인하고 있습니다.</p>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="study-records-challenge is-error" role="alert">
        <span className="study-records-challenge-icon" aria-hidden="true">
          <EmojiEventsOutlinedIcon />
        </span>
        <div>
          <strong>공부 도전을 확인하지 못했습니다.</strong>
          <p>{loadError}</p>
        </div>
        <button
          disabled={loading}
          onClick={() => void loadChallenge(true)}
          type="button"
        >
          다시 불러오기
        </button>
      </section>
    );
  }

  const reportedChallenge = data.currentChallenge;
  const challenge =
    data.isParticipating && reportedChallenge?.confirmedAt
      ? reportedChallenge
      : null;
  const rules = challenge
    ? (data.acceptedRules ?? data.joinRules)
    : data.joinRules;
  const rewardLabel = studyChallengeRewardLabel(rules.version);
  const currentChallengeRulesPdfUrl = challenge
    ? studyChallengeRulesPdfUrl(challenge.rulesVersion)
    : null;
  const availableChallengeRulesPdfUrl = challenge
    ? null
    : studyChallengeRulesPdfUrl(rules.version);
  const agreementRulesPdfUrl = visibleAgreementSnapshot
    ? studyChallengeRulesPdfUrl(visibleAgreementSnapshot.rules.version)
    : null;
  const agreementUsesFirstFailureRule =
    visibleAgreementSnapshot?.rules.version ===
    FIRST_FAILURE_ENDS_RULES_VERSION;
  const now = new Date();

  const panel = challenge ? (
    <>
      <div className="study-records-challenge-head">
        <span className="study-records-challenge-icon" aria-hidden="true">
          <EmojiEventsOutlinedIcon />
        </span>
        <div>
          <small>{challengeStatusLabel(challenge.status)}</small>
          <h2>
            {challenge.requiredWeeks}주 · 매주{" "}
            {formatTarget(challenge.weeklyTargetSeconds)}
          </h2>
          <p>{formatPeriod(challenge.startsAt, challenge.endsAtExclusive)}</p>
        </div>
        <span
          className={`study-records-challenge-state is-${challenge.status.toLowerCase()}`}
        >
          {challenge.status === "SCHEDULED" ? "시작 전" : "진행 중"}
        </span>
      </div>

      <div
        className="study-records-challenge-weeks"
        aria-label="주차별 도전 현황"
      >
        {challenge.weeks.map((week) => (
          <article
            className={`is-${week.status.toLowerCase()}${
              isCurrentWeek(week, now) ? " is-current" : ""
            }`}
            key={week.weekNumber}
          >
            <span>{week.weekNumber}주차</span>
            <strong>{weekLabel(week, challenge.status)}</strong>
          </article>
        ))}
      </div>

      <div className="study-records-challenge-member-actions">
        <p className="study-records-challenge-note">
          실제 공부 상태로 기록된 시간만 반영되며, 주차별 목표는 각각 달성해야
          합니다.
          {currentChallengeRulesPdfUrl && (
            <>
              {" "}
              <a
                className="study-records-challenge-policy-link"
                href={currentChallengeRulesPdfUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                도전 규칙 전문 PDF 보기 (새 창)
              </a>
            </>
          )}
        </p>
        {canTerminateChallenge(challenge) && (
          <button
            className="study-records-challenge-terminate"
            disabled={terminating}
            onClick={() => openTerminationDialog(challenge)}
            type="button"
          >
            도전 종료
          </button>
        )}
      </div>
    </>
  ) : (
    <>
      <div className="study-records-challenge-head">
        <span className="study-records-challenge-icon" aria-hidden="true">
          <EmojiEventsOutlinedIcon />
        </span>
        <div>
          <small>4주 공부 도전</small>
          <h2>
            {rules.requiredWeeks}주 동안 매주{" "}
            {formatTarget(rules.weeklyTargetSeconds)}
          </h2>
          <p>
            {formatPeriod(
              data.nextChallenge?.startsAt,
              data.nextChallenge?.endsAtExclusive,
            )}
          </p>
        </div>
      </div>

      <div className="study-records-challenge-summary">
        <span>
          <small>시작일</small>
          <strong>{formatDate(data.nextChallenge?.startsAt)}</strong>
        </span>
        <span>
          <small>성공 보상</small>
          <strong>{rewardLabel ?? "규칙 업데이트 필요"}</strong>
        </span>
      </div>

      {availableChallengeRulesPdfUrl && (
        <a
          aria-label="도전 규칙 전문 PDF 새 창에서 보기"
          className="study-records-challenge-policy-link is-prominent"
          href={availableChallengeRulesPdfUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <PictureAsPdfOutlinedIcon aria-hidden="true" />
          <span>전체 도전 규칙 PDF 보기</span>
        </a>
      )}

      {data.canJoin &&
      rewardLabel &&
      isSubmittableChallengeWindow(data.nextChallenge) ? (
        <button
          className="study-records-challenge-join"
          onClick={openDialog}
          type="button"
        >
          도전 규칙 확인
        </button>
      ) : (
        <p className="study-records-challenge-unavailable">
          {data.unavailableReason ??
            (rewardLabel
              ? isSubmittableChallengeWindow(data.nextChallenge)
                ? "현재 이 도전에 참여할 수 없습니다. 관리자에게 문의해 주세요."
                : "도전 기간을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요."
              : "새로운 도전 규칙을 표시하려면 앱 업데이트가 필요합니다.")}
        </p>
      )}
    </>
  );

  const latestResult = data.latestResult;
  const latestResultMessage = latestResult
    ? earlyFailureResultMessage(latestResult) ??
      terminationResultMessage(latestResult)
    : null;

  return (
    <>
      <section
        aria-busy={loading || joining || terminating}
        className={`study-records-challenge${challenge ? " is-participating" : ""}`}
      >
        {panel}

        {latestResult && latestResult.id !== challenge?.id && (
          <div
            className={`study-records-challenge-result is-${latestResult.status.toLowerCase()}`}
          >
            <span>{resultLabel(latestResult)}</span>
            <strong>{challengeStatusLabel(latestResult.status)}</strong>
            <small>
              {formatPeriod(
                latestResult.startsAt,
                latestResult.endsAtExclusive,
              )}
            </small>
            {latestResultMessage && <p>{latestResultMessage}</p>}
          </div>
        )}

        {loadError && (
          <p className="study-records-challenge-stale" role="status">
            최신 도전 정보를 확인하지 못해 이전 상태를 표시합니다.
          </p>
        )}

        {actionNotice && (
          <p className="study-records-challenge-stale" role="status">
            {actionNotice}
          </p>
        )}

        {completionNotice && (
          <p
            className="study-records-challenge-complete"
            ref={completionNoticeRef}
            role="status"
            tabIndex={-1}
          >
            {completionNotice}
          </p>
        )}
      </section>

      {visibleAgreementSnapshot &&
        createPortal(
          <div
            className="study-records-challenge-dialog"
            onClick={handleDialogClick}
            role="presentation"
          >
            <div
              aria-busy={joining}
              aria-describedby={descriptionId}
              aria-labelledby={titleId}
              aria-modal="true"
              className="study-records-challenge-dialog-card"
              onKeyDown={handleDialogKeyDown}
              ref={dialogRef}
              role="dialog"
              tabIndex={-1}
            >
              <span
                className="study-records-challenge-dialog-icon"
                aria-hidden="true"
              >
                <EmojiEventsOutlinedIcon />
              </span>
              <div className="study-records-challenge-dialog-heading">
                <small>선택 참여</small>
                <h2 id={titleId}>4주 공부 도전에 참여할까요?</h2>
                <p id={descriptionId}>
                  아래 기간과 집계 기준, 성공 조건 및 보상을 확인해 주세요.
                </p>
              </div>

              <div className="study-records-challenge-dialog-period">
                <span>도전 기간</span>
                <strong>
                  {formatPeriod(
                    visibleAgreementSnapshot.nextChallenge.startsAt,
                    visibleAgreementSnapshot.nextChallenge.endsAtExclusive,
                  )}
                </strong>
              </div>

              <ul className="study-records-challenge-rules">
                <li>
                  {`매주 월요일부터 일요일까지 실제 공부시간 ${formatTarget(
                    visibleAgreementSnapshot.rules.weeklyTargetSeconds,
                  )}을 ${visibleAgreementSnapshot.rules.requiredWeeks}주 모두 각각 달성해야 합니다. 남은 시간은 이월되지 않으며, 휴식 상태는 제외되고 ‘계속 공부하기’로 전환한 시간부터 다시 포함됩니다.`}
                </li>
                {agreementUsesFirstFailureRule ? (
                  <>
                    <li>
                      참여 기회는 유료 이용권 1개월당 1회, 도전 보상 이용권당
                      1회이며, 결과·취소·중도 포기와 관계없이 복구되지
                      않습니다.
                    </li>
                    <li>
                      한 주라도 목표에 미달하면 해당 주 종료 후 즉시 종료되고
                      이후 주차는 집계되지 않습니다. 취소·중도 포기 후에도
                      안내된 4주 기간이 끝나야 다시 참여할 수 있습니다.
                    </li>
                    <li>
                      4주 모두 달성하면 이용기간 1개월이 연장되고, 그 보상
                      이용권으로 다음 도전에 참여할 수 있습니다.
                    </li>
                  </>
                ) : (
                  <>
                    <li>{visibleAgreementSnapshot.rewardLabel}</li>
                    <li>
                      참여 확정 후 취소·중도 포기를 선택할 수 있지만, 참여
                      기회와 기간 제한은 그대로 적용됩니다.
                    </li>
                  </>
                )}
              </ul>

              {agreementRulesPdfUrl && (
                <a
                  aria-label="도전 규칙 전문 PDF 새 창에서 보기"
                  className="study-records-challenge-policy-link is-prominent"
                  href={agreementRulesPdfUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <PictureAsPdfOutlinedIcon aria-hidden="true" />
                  <span>전체 도전 규칙 PDF 보기</span>
                </a>
              )}

              <label className="study-records-challenge-agreement">
                <input
                  checked={agreed}
                  disabled={joining}
                  onChange={(event) => setAgreed(event.target.checked)}
                  ref={agreementRef}
                  type="checkbox"
                />
                <span>
                  위 기간, 공부시간 집계 기준, 성공 조건과 보상을 확인했으며
                  참여에 동의합니다.
                </span>
              </label>

              {actionError && (
                <p
                  className="study-records-challenge-dialog-error"
                  role="alert"
                >
                  {actionError}
                </p>
              )}

              <div className="study-records-challenge-dialog-actions">
                <button disabled={joining} onClick={closeDialog} type="button">
                  다음에
                </button>
                <button
                  disabled={!agreed || joining}
                  onClick={() => void handleJoin()}
                  type="button"
                >
                  {joining ? "참여 확정 중…" : "동의하고 참여하기"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {visibleTerminationSnapshot &&
        createPortal(
          <div
            className="study-records-challenge-dialog"
            onClick={handleDialogClick}
            role="presentation"
          >
            <div
              aria-busy={terminating}
              aria-describedby={descriptionId}
              aria-labelledby={titleId}
              aria-modal="true"
              className="study-records-challenge-dialog-card is-termination"
              onKeyDown={handleDialogKeyDown}
              ref={dialogRef}
              role="dialog"
              tabIndex={-1}
            >
              <span
                className="study-records-challenge-dialog-icon"
                aria-hidden="true"
              >
                <ReportProblemOutlinedIcon />
              </span>
              <div className="study-records-challenge-dialog-heading">
                <small>도전 종료</small>
                <h2 id={titleId}>4주 공부 도전을 종료할까요?</h2>
                <p id={descriptionId}>
                  서버 처리 시각이 시작 전이면 참여 취소, 시작 후이면 중도
                  포기로 기록됩니다.
                </p>
              </div>

              <div className="study-records-challenge-dialog-period">
                <span>현재 도전 기간</span>
                <strong>
                  {formatPeriod(
                    visibleTerminationSnapshot.startsAt,
                    visibleTerminationSnapshot.endsAtExclusive,
                  )}
                </strong>
              </div>

              <ul className="study-records-challenge-rules">
                <li>
                  이번 도전에 사용한 참여 기회는 종료 후에도 복구되지
                  않습니다.
                </li>
                <li>
                  처음 안내된 4주 기간이 끝나기 전에는 새로운 도전에 참여할
                  수 없습니다.
                </li>
                <li>
                  남은 주차는 미진행으로 처리되며, 이후 공부시간은 이 도전
                  실적으로 집계되지 않습니다.
                </li>
                <li>
                  이 도전으로 추가된 이용기간이 있다면 종료와 함께
                  회수됩니다.
                </li>
              </ul>

              <label className="study-records-challenge-agreement">
                <input
                  checked={terminationConfirmed}
                  disabled={terminating}
                  onChange={(event) =>
                    setTerminationConfirmed(event.target.checked)
                  }
                  ref={agreementRef}
                  type="checkbox"
                />
                <span>
                  참여 기회가 복구되지 않으며 기존 도전 기간 동안 다시 참여할
                  수 없음을 확인했습니다.
                </span>
              </label>

              {terminationError && (
                <p
                  className="study-records-challenge-dialog-error"
                  role="alert"
                >
                  {terminationError}
                </p>
              )}

              <div className="study-records-challenge-dialog-actions is-termination">
                <button
                  disabled={terminating}
                  onClick={closeTerminationDialog}
                  type="button"
                >
                  도전 유지
                </button>
                <button
                  disabled={!terminationConfirmed || terminating}
                  onClick={() => void handleTerminate()}
                  type="button"
                >
                  {terminating ? "종료 처리 중…" : "종료하기"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
