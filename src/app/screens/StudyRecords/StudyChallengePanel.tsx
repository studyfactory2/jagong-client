import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
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
} from "../../services/study-challenge.service";
import type {
  MyStudyChallengeStatus,
  StudyChallenge,
  StudyChallengeRules,
  StudyChallengeStatus,
  StudyChallengeWeek,
  StudyStatisticsWindow,
} from "../../../lib/types";

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
const FIRST_FAILURE_ENDS_RULES_VERSION = "2026-08-21-v2";
const RULES_REWARD_LABELS: Record<string, string> = {
  "2026-07-31-v1": "이용기간 1개월 연장",
  [FIRST_FAILURE_ENDS_RULES_VERSION]: "이용기간 1개월 연장",
};

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
  return "도전 취소";
}

function weekLabel(week: StudyChallengeWeek): string {
  if (week.status === "PASSED") return "달성";
  if (week.status === "FAILED") return "미달성";
  if (week.status === "SKIPPED") return "미진행";
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
  return challenge.status === "PASSED" ? "지난 도전 성공" : "지난 도전 결과";
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

export default function StudyChallengePanel({
  refreshToken,
}: StudyChallengePanelProps) {
  const titleId = useId();
  const descriptionId = useId();
  const requestRef = useRef(0);
  const agreementRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<MyStudyChallengeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [agreementSnapshot, setAgreementSnapshot] =
    useState<ChallengeAgreementSnapshot | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [joining, setJoining] = useState(false);
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

  const loadChallenge = useCallback(async (showLoading: boolean) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    if (showLoading) setLoading(true);

    try {
      const next = await getMyStudyChallenge();
      if (requestRef.current !== requestId) return undefined;
      setData(next);
      setLoadError("");
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
    if (!visibleAgreementSnapshot) return;

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
  }, [visibleAgreementSnapshot]);

  const openDialog = () => {
    if (!data?.canJoin || !isSubmittableChallengeWindow(data.nextChallenge)) {
      return;
    }
    const rewardLabel = RULES_REWARD_LABELS[data.joinRules.version];
    if (!rewardLabel) return;

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
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (joining) return;
    setDialogOpen(false);
    setAgreementSnapshot(null);
    setAgreed(false);
    setActionError("");
  };

  const handleDialogClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeDialog();
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
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
      return;
    }

    if (
      event.shiftKey &&
      (document.activeElement === first ||
        !dialogRef.current?.contains(document.activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last ||
        !dialogRef.current?.contains(document.activeElement))
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
  const rewardLabel = RULES_REWARD_LABELS[rules.version] ?? null;
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
            <strong>{weekLabel(week)}</strong>
          </article>
        ))}
      </div>

      <p className="study-records-challenge-note">
        실제 공부 상태로 기록된 시간만 반영되며, 주차별 목표는 각각 달성해야
        합니다.
      </p>
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
    ? earlyFailureResultMessage(latestResult)
    : null;

  return (
    <>
      <section
        aria-busy={loading || joining}
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
      </section>

      {visibleAgreementSnapshot &&
        createPortal(
          <div
            className="study-records-challenge-dialog"
            onClick={handleDialogClick}
            role="presentation"
          >
            <div
              aria-describedby={descriptionId}
              aria-labelledby={titleId}
              aria-modal="true"
              className="study-records-challenge-dialog-card"
              onKeyDown={handleDialogKeyDown}
              ref={dialogRef}
              role="dialog"
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
                  )}을 달성해야 합니다.`}
                </li>
                <li>
                  {visibleAgreementSnapshot.rules.requiredWeeks}주 모두 각각
                  달성해야 하며 남은 시간은 다음 주로 이월되지 않습니다.
                </li>
                {visibleAgreementSnapshot.rules.version ===
                  FIRST_FAILURE_ENDS_RULES_VERSION && (
                  <>
                    <li>
                      참여 확정 시 유료 이용권은 1개월분당 1회, 도전 보상
                      이용권은 1회분의 참여 기회를 사용하며,
                      성공·미달성·취소·중도 포기 여부와 관계없이 복구되지
                      않습니다.
                    </li>
                    <li>
                      도전이 조기 종료되거나 취소되어도 처음 안내된 4주
                      기간이 끝나기 전에는 다음 도전에 참여할 수 없습니다.
                    </li>
                    <li>
                      한 주라도 목표에 미달하면 해당 주차 종료 후 도전이 즉시
                      종료되며, 이후 주차는 진행·집계되지 않습니다.
                    </li>
                  </>
                )}
                <li>
                  휴식 상태는 제외되며, 휴식시간에 ‘계속 공부하기’를 선택한
                  시간은 포함됩니다.
                </li>
                <li>
                  {visibleAgreementSnapshot.rules.version ===
                  FIRST_FAILURE_ENDS_RULES_VERSION
                    ? "4주 모두 달성하면 이용기간 1개월 연장 보상이 지급되며, 해당 보상 이용권으로 다음 도전에 다시 참여할 수 있습니다."
                    : visibleAgreementSnapshot.rewardLabel}
                </li>
                <li>참여 확정 후 변경이 필요하면 관리자에게 문의해 주세요.</li>
              </ul>

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
    </>
  );
}
