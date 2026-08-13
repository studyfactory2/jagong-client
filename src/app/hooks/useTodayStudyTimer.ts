import { useCallback, useEffect, useRef, useState } from "react";
import type { StudyTimeStatus } from "../../lib/types";
import { getMyStudyStatistics } from "../services/study-statistics.service";

type StudyTimerAnchor = {
  dateKey: string;
  generatedAtMs: number;
  seconds: number;
};

type StudyTimerSource = {
  dateKey: string;
  error: boolean;
  hidden: boolean;
  loading: boolean;
  state: "STUDY" | "BREAK" | null;
  stateStartedAtMs: number | null;
};

type UseTodayStudyTimerInput = {
  cameraPausedForBreak: boolean;
  joined: boolean;
  now: Date;
  refreshStudyStatus: () => Promise<void>;
  studyStatus: StudyTimeStatus | null;
  studyStatusError: string;
  studyStatusLoading: boolean;
};

const STUDY_TIMER_REQUEST_TIMEOUT_MS = 10000;

const seoulDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function seoulDateKey(date: Date): string {
  const parts = seoulDateFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function projectStudyTimerSeconds(
  anchor: StudyTimerAnchor,
  source: StudyTimerSource,
  atMs: number,
): number {
  if (anchor.dateKey !== source.dateKey) return 0;
  if (source.hidden || source.loading || source.error || !source.state) {
    return anchor.seconds;
  }

  const transitionAtMs = source.stateStartedAtMs;
  const countedBoundaryMs =
    transitionAtMs === null
      ? anchor.generatedAtMs
      : Math.max(anchor.generatedAtMs, transitionAtMs);
  const additionalSeconds =
    source.state === "STUDY"
      ? Math.max(0, Math.floor((atMs - countedBoundaryMs) / 1000))
      : transitionAtMs !== null && transitionAtMs > anchor.generatedAtMs
        ? Math.max(
            0,
            Math.floor((transitionAtMs - anchor.generatedAtMs) / 1000),
          )
        : 0;
  return anchor.seconds + additionalSeconds;
}

export function formatTodayStudyTime(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return "--:--:--";

  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  return [hours, minutes, remainder]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function useTodayStudyTimer({
  cameraPausedForBreak,
  joined,
  now,
  refreshStudyStatus,
  studyStatus,
  studyStatusError,
  studyStatusLoading,
}: UseTodayStudyTimerInput) {
  const [todayStudySeconds, setTodayStudySeconds] = useState<number>();
  const studyTimerAnchorRef = useRef<StudyTimerAnchor | null>(null);
  const studyTimerNeedsRefreshRef = useRef(true);
  const studyTimerMountedRef = useRef(true);
  const studyTimerRefreshPromiseRef = useRef<Promise<boolean> | null>(null);
  const studyTimerRefreshQueuedRef = useRef(false);
  const refreshTodayStudyRef = useRef<() => Promise<boolean>>(
    async () => false,
  );
  const studyTimerSourceRef = useRef<StudyTimerSource>({
    dateKey: "",
    error: false,
    hidden: false,
    loading: true,
    state: null,
    stateStartedAtMs: null,
  });
  const todayDateKey = seoulDateKey(now);

  useEffect(() => {
    const previousSource = studyTimerSourceRef.current;
    const state =
      !joined || !studyStatus?.active || studyStatus.source === "SYSTEM"
        ? null
        : cameraPausedForBreak
          ? "BREAK"
          : studyStatus.state === "STUDY" || studyStatus.state === "BREAK"
            ? studyStatus.state
            : null;
    const stateStartedAt = studyStatus?.stateStartedAt
      ? new Date(studyStatus.stateStartedAt).getTime()
      : Number.NaN;
    const nextStateStartedAtMs = Number.isFinite(stateStartedAt)
      ? stateStartedAt
      : null;
    const nextSource: StudyTimerSource = {
      dateKey: todayDateKey,
      error: Boolean(studyStatusError),
      hidden: document.visibilityState !== "visible",
      loading: studyStatusLoading,
      state,
      stateStartedAtMs: nextStateStartedAtMs,
    };
    if (
      previousSource.dateKey !== todayDateKey ||
      previousSource.state !== state ||
      previousSource.stateStartedAtMs !== nextStateStartedAtMs
    ) {
      studyTimerNeedsRefreshRef.current = true;
      if (joined && document.visibilityState === "visible") {
        window.setTimeout(() => void refreshTodayStudyRef.current(), 0);
      }
    }
    studyTimerSourceRef.current = nextSource;
  }, [
    cameraPausedForBreak,
    joined,
    studyStatus,
    studyStatusError,
    studyStatusLoading,
    todayDateKey,
  ]);

  useEffect(() => {
    studyTimerMountedRef.current = true;
    return () => {
      studyTimerMountedRef.current = false;
    };
  }, []);

  const refreshTodayStudy = useCallback((): Promise<boolean> => {
    if (studyTimerRefreshPromiseRef.current) {
      studyTimerRefreshQueuedRef.current = true;
      return studyTimerRefreshPromiseRef.current;
    }

    const refreshPromise = (async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        STUDY_TIMER_REQUEST_TIMEOUT_MS,
      );
      try {
        const statistics = await getMyStudyStatistics({
          signal: controller.signal,
        });
        if (!studyTimerMountedRef.current) return false;

        const generatedAtMs = new Date(statistics.generatedAt).getTime();
        if (!Number.isFinite(generatedAtMs)) return false;
        const previous = studyTimerAnchorRef.current;
        if (previous && generatedAtMs < previous.generatedAtMs) return true;

        const startsAt = new Date(statistics.today.startsAt);
        const nextAnchor = {
          dateKey: Number.isNaN(startsAt.getTime())
            ? seoulDateKey(new Date(generatedAtMs))
            : seoulDateKey(startsAt),
          generatedAtMs,
          seconds: Math.max(0, Math.floor(statistics.today.studySeconds)),
        };
        studyTimerAnchorRef.current = nextAnchor;
        const currentSource = studyTimerSourceRef.current;
        const coversCurrentTransition =
          currentSource.stateStartedAtMs === null ||
          generatedAtMs >= currentSource.stateStartedAtMs;
        if (document.visibilityState === "visible" && coversCurrentTransition) {
          studyTimerNeedsRefreshRef.current = false;
        }
        if (coversCurrentTransition) {
          setTodayStudySeconds(
            projectStudyTimerSeconds(nextAnchor, currentSource, Date.now()),
          );
        }
        return true;
      } catch {
        return false;
      } finally {
        window.clearTimeout(timeoutId);
      }
    })();
    studyTimerRefreshPromiseRef.current = refreshPromise;
    void refreshPromise.finally(() => {
      if (studyTimerRefreshPromiseRef.current === refreshPromise) {
        studyTimerRefreshPromiseRef.current = null;
        if (
          studyTimerRefreshQueuedRef.current &&
          studyTimerMountedRef.current
        ) {
          studyTimerRefreshQueuedRef.current = false;
          window.setTimeout(() => void refreshTodayStudyRef.current(), 0);
        }
      }
    });
    return refreshPromise;
  }, []);

  useEffect(() => {
    refreshTodayStudyRef.current = refreshTodayStudy;
  }, [refreshTodayStudy]);

  useEffect(() => {
    if (!joined) return undefined;

    const initialRefreshTimer = window.setTimeout(
      () => void refreshTodayStudy(),
      0,
    );
    const refreshTimer = window.setInterval(
      () => void refreshTodayStudy(),
      15000,
    );
    const refreshAfterInactivity = () => {
      if (document.visibilityState !== "visible") {
        studyTimerNeedsRefreshRef.current = true;
        studyTimerSourceRef.current.hidden = true;
        return;
      }
      studyTimerSourceRef.current.hidden = false;
      studyTimerNeedsRefreshRef.current = true;
      void refreshStudyStatus().finally(() => void refreshTodayStudy());
    };

    document.addEventListener("visibilitychange", refreshAfterInactivity);
    window.addEventListener("focus", refreshAfterInactivity);
    return () => {
      window.clearTimeout(initialRefreshTimer);
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshAfterInactivity);
      window.removeEventListener("focus", refreshAfterInactivity);
    };
  }, [joined, refreshStudyStatus, refreshTodayStudy]);

  useEffect(() => {
    const updateTimer = () => {
      const source = studyTimerSourceRef.current;
      const anchor = studyTimerAnchorRef.current;
      if (!anchor) return;

      if (anchor.dateKey !== source.dateKey) {
        setTodayStudySeconds(0);
        return;
      }
      if (
        source.hidden ||
        source.loading ||
        source.error ||
        studyTimerNeedsRefreshRef.current ||
        !source.state
      ) {
        return;
      }

      const nextSeconds = projectStudyTimerSeconds(anchor, source, Date.now());
      setTodayStudySeconds((previous) =>
        previous === nextSeconds ? previous : nextSeconds,
      );
    };

    const initialTimer = window.setTimeout(updateTimer, 0);
    const intervalTimer = window.setInterval(updateTimer, 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, []);

  const refreshAfterStudyTransition = useCallback(() => {
    studyTimerNeedsRefreshRef.current = true;
    void refreshTodayStudy();
  }, [refreshTodayStudy]);

  return {
    refreshAfterStudyTransition,
    todayStudySeconds,
    todayStudyTime: formatTodayStudyTime(todayStudySeconds),
  };
}
