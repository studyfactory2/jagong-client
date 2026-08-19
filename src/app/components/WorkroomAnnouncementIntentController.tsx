import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useReportJoinedWorkroomSession } from "../context/WorkroomAnnouncementRuntimeContext";
import { useWorkroomSession } from "../context/WorkroomSessionContext";
import {
  hasWorkroomAnnouncementIntentState,
  readWorkroomAnnouncementIntent,
  withoutWorkroomAnnouncementIntent,
  type WorkroomAnnouncementIntent,
} from "../utils/workroom-announcement";

type ArmedAnnouncementResume = {
  intent: WorkroomAnnouncementIntent;
  sessionId: string | null;
  stateStartedAt: string | null;
};

export default function WorkroomAnnouncementIntentController() {
  const location = useLocation();
  const navigate = useNavigate();
  const armedResumeRef = useRef<ArmedAnnouncementResume | null>(null);
  const {
    joined,
    joining,
    studyStatus,
    studyStatusLoading,
    studyStatusError,
    studyActionPending,
    resumeStudy,
  } = useWorkroomSession();
  const intent = useMemo(
    () => readWorkroomAnnouncementIntent(location.state),
    [location.state],
  );
  const hasIntentState = useMemo(
    () => hasWorkroomAnnouncementIntentState(location.state),
    [location.state],
  );

  useReportJoinedWorkroomSession(joined);

  const clearIntent = useCallback(() => {
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: withoutWorkroomAnnouncementIntent(location.state),
    });
  }, [
    location.hash,
    location.pathname,
    location.search,
    location.state,
    navigate,
  ]);

  useEffect(() => {
    if (!intent) {
      if (hasIntentState) clearIntent();
      return undefined;
    }
    const delay = Date.parse(intent.expiresAt) - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) {
      clearIntent();
      return undefined;
    }

    const expiryTimer = window.setTimeout(clearIntent, delay + 50);
    return () => window.clearTimeout(expiryTimer);
  }, [clearIntent, hasIntentState, intent]);

  useEffect(() => {
    if (!intent || studyActionPending !== "BREAK") return;
    clearIntent();
  }, [clearIntent, intent, studyActionPending]);

  useEffect(() => {
    if (
      !intent ||
      !joined ||
      joining ||
      studyStatusLoading ||
      studyStatusError ||
      studyActionPending ||
      !studyStatus?.active ||
      !studyStatus.state ||
      !studyStatus.source
    ) {
      return;
    }

    if (Date.now() >= Date.parse(intent.expiresAt)) {
      clearIntent();
      return;
    }

    if (
      studyStatus.source === "ADMIN" ||
      studyStatus.source === "SYSTEM" ||
      studyStatus.source === "ROOM"
    ) {
      clearIntent();
      return;
    }

    if (intent.kind === "START_STUDY" && studyStatus.state === "STUDY") {
      clearIntent();
      return;
    }

    if (armedResumeRef.current) return;
    armedResumeRef.current = {
      intent,
      sessionId: studyStatus.sessionId ?? null,
      stateStartedAt: studyStatus.stateStartedAt ?? null,
    };
    clearIntent();
  }, [
    clearIntent,
    intent,
    joined,
    joining,
    studyActionPending,
    studyStatus,
    studyStatusError,
    studyStatusLoading,
  ]);

  useEffect(() => {
    const armed = armedResumeRef.current;
    if (!armed || intent) return;

    armedResumeRef.current = null;

    if (
      !joined ||
      joining ||
      studyStatusLoading ||
      studyStatusError ||
      studyActionPending ||
      !studyStatus?.active ||
      !studyStatus.state ||
      !studyStatus.source ||
      studyStatus.sessionId !== armed.sessionId ||
      Date.now() >= Date.parse(armed.intent.expiresAt)
    ) {
      return;
    }

    if (
      studyStatus.source === "ADMIN" ||
      studyStatus.source === "SYSTEM" ||
      studyStatus.source === "ROOM"
    ) {
      return;
    }

    if (
      studyStatus.state === "BREAK" &&
      studyStatus.source === "MEMBER" &&
      studyStatus.stateStartedAt !== armed.stateStartedAt
    ) {
      return;
    }

    if (armed.intent.kind === "START_STUDY" && studyStatus.state === "STUDY") {
      return;
    }

    void resumeStudy().catch(() => undefined);
  }, [
    intent,
    joined,
    joining,
    resumeStudy,
    studyActionPending,
    studyStatus,
    studyStatusError,
    studyStatusLoading,
  ]);

  return null;
}
