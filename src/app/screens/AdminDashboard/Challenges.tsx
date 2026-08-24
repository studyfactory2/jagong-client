import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AdminStudyChallengeDetail,
  AdminStudyChallengeListResult,
} from "../../../lib/types";
import {
  getAdminStudyChallenge,
  getAdminStudyChallenges,
  terminateAdminStudyChallenge,
} from "../../services/study-challenge.service";
import AdminChallengeDetail from "./challenges/AdminChallengeDetail";
import AdminChallengeDirectory from "./challenges/AdminChallengeDirectory";
import AdminChallengeEnrollmentDialog from "./challenges/AdminChallengeEnrollmentDialog";
import AdminChallengeTerminationDialog from "./challenges/AdminChallengeTerminationDialog";
import {
  EMPTY_RESULT,
  PAGE_LIMIT,
  TERMINATION_REASON_MAX_LENGTH,
  applyTerminationToDetail,
  applyTerminationToListItem,
  canTerminateChallenge,
  observedTerminationMessage,
  periodText,
  terminationCompletedMessage,
  terminationUnavailableMessage,
  type ChallengeStatusFilter,
} from "./challenges/admin-challenge.helpers";

const SEARCH_DELAY_MS = 350;
const DETAIL_POLL_INTERVAL_MS = 60000;

export default function Challenges() {
  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const selectedIdRef = useRef("");
  const terminationInFlightRef = useRef(false);
  const terminationSnapshotRef = useRef<AdminStudyChallengeDetail | null>(null);
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);
  const mobileBackRef = useRef<HTMLButtonElement | null>(null);
  const enrollmentTriggerRef = useRef<HTMLButtonElement | null>(null);
  const terminationTriggerRef = useRef<HTMLButtonElement | null>(null);
  const actionNoticeRef = useRef<HTMLParagraphElement | null>(null);
  const completionNoticeRef = useRef<HTMLParagraphElement | null>(null);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ChallengeStatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [result, setResult] =
    useState<AdminStudyChallengeListResult>(EMPTY_RESULT);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<AdminStudyChallengeDetail | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const [terminationSnapshot, setTerminationSnapshot] =
    useState<AdminStudyChallengeDetail | null>(null);
  const [terminationReason, setTerminationReason] = useState("");
  const [terminationConfirmed, setTerminationConfirmed] = useState(false);
  const [terminationError, setTerminationError] = useState("");
  const [terminating, setTerminating] = useState(false);
  const [actionNotice, setActionNotice] = useState("");
  const [completionNotice, setCompletionNotice] = useState("");
  const visibleTerminationSnapshot =
    !enrollmentOpen &&
    terminationSnapshot &&
    detail?.id === terminationSnapshot.id &&
    selectedId === terminationSnapshot.id &&
    canTerminateChallenge(detail)
      ? terminationSnapshot
      : null;

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(searchText.trim()),
      SEARCH_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const loadList = useCallback(
    async (silent = false) => {
      const requestId = ++listRequestRef.current;
      if (!silent) {
        setListLoading(true);
        setListError("");
      }
      try {
        const next = await getAdminStudyChallenges({
          page,
          limit: PAGE_LIMIT,
          text: debouncedSearch || undefined,
          status: statusFilter === "ALL" ? undefined : statusFilter,
      });
      if (requestId !== listRequestRef.current) return;
      const currentSelection = selectedIdRef.current;
      const keepsPendingTerminationVisible =
        terminationSnapshotRef.current?.id === currentSelection;
      const includesCurrentSelection = next.list.some(
        (item) => item.id === currentSelection,
      );
      if (keepsPendingTerminationVisible && !includesCurrentSelection) return;
      setResult(next);
      if (!next.list.length) {
        detailRequestRef.current += 1;
        setDetail(null);
        setDetailError("");
        setDetailLoading(false);
      }
      const nextSelection = includesCurrentSelection
        ? currentSelection
        : (next.list[0]?.id ?? "");
        selectedIdRef.current = nextSelection;
        setSelectedId(nextSelection);
    } catch (error) {
      if (requestId !== listRequestRef.current || silent) return;
      const errorMessage =
        error instanceof Error
          ? error.message
          : "도전 참여자 목록을 불러오지 못했습니다.";
      if (
        terminationSnapshotRef.current?.id === selectedIdRef.current
      ) {
        setListError(errorMessage);
        return;
      }
      detailRequestRef.current += 1;
      setResult(EMPTY_RESULT);
      selectedIdRef.current = "";
        setSelectedId("");
        setDetail(null);
      setDetailError("");
      setDetailLoading(false);
      setListError(errorMessage);
      } finally {
        if (!silent && requestId === listRequestRef.current) {
          setListLoading(false);
        }
      }
    },
    [debouncedSearch, page, statusFilter],
  );

  const loadDetail = useCallback(
    async (
      challengeId: string,
      silent = false,
    ): Promise<AdminStudyChallengeDetail | null | undefined> => {
      const requestId = ++detailRequestRef.current;
      if (!silent) {
        setDetailLoading(true);
        setDetailError("");
        setDetail(null);
      }
      try {
        const next = await getAdminStudyChallenge(challengeId);
        if (
          requestId !== detailRequestRef.current ||
          selectedIdRef.current !== challengeId
        ) {
          return undefined;
        }
        setDetail(next);
        setDetailError("");
        const pendingTermination = terminationSnapshotRef.current;
        if (
          pendingTermination?.id === next.id &&
          !canTerminateChallenge(next)
        ) {
          terminationSnapshotRef.current = null;
          setTerminationSnapshot(null);
          setTerminationReason("");
          setTerminationConfirmed(false);
          setTerminationError("");
          if (next.status === "CANCELLED" || next.status === "WITHDRAWN") {
            setCompletionNotice(
              observedTerminationMessage(next.status, next.member.name),
            );
            setActionNotice("");
          } else {
            setCompletionNotice("");
            setActionNotice(terminationUnavailableMessage(next));
          }
        }
        return next;
      } catch (error) {
        if (
          requestId !== detailRequestRef.current ||
          selectedIdRef.current !== challengeId
        ) {
          return undefined;
        }
        if (!silent) {
          setDetailError(
            error instanceof Error
              ? error.message
              : "도전 상세 정보를 불러오지 못했습니다.",
          );
        }
        return null;
      } finally {
        if (!silent && requestId === detailRequestRef.current) {
          setDetailLoading(false);
        }
      }
    },
    [setTerminationConfirmed, setTerminationError, setTerminationReason],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadList(), 0);
    return () => {
      window.clearTimeout(timer);
      listRequestRef.current += 1;
    };
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setTimeout(() => void loadDetail(selectedId), 0);
    return () => {
      window.clearTimeout(timer);
      detailRequestRef.current += 1;
    };
  }, [loadDetail, selectedId]);

  useEffect(() => {
    if (!selectedId) return;

    const refreshVisibleDetail = () => {
      if (document.visibilityState !== "visible") return;
      if (terminationInFlightRef.current) return;
      const pendingTermination = terminationSnapshotRef.current;
      if (pendingTermination) {
        if (detailLoading) return;
        void loadDetail(pendingTermination.id, true).then((next) => {
          if (next && !canTerminateChallenge(next)) void loadList(true);
        });
        return;
      }
      if (!listLoading) void loadList(true);
      if (!detailLoading) void loadDetail(selectedId, true);
    };
    const timer = window.setInterval(
      refreshVisibleDetail,
      DETAIL_POLL_INTERVAL_MS,
    );
    document.addEventListener("visibilitychange", refreshVisibleDetail);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisibleDetail);
    };
  }, [detailLoading, listLoading, loadDetail, loadList, selectedId]);

  useEffect(() => {
    if (!completionNotice) return;
    const focusFrame = window.requestAnimationFrame(() => {
      completionNoticeRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [completionNotice]);

  useEffect(() => {
    if (!actionNotice) return;
    const focusFrame = window.requestAnimationFrame(() => {
      actionNoticeRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [actionNotice]);

  const selectedSummary = useMemo(
    () => result.list.find((item) => item.id === selectedId) ?? null,
    [result.list, selectedId],
  );

  function resetTerminationDialog() {
    terminationSnapshotRef.current = null;
    setTerminationSnapshot(null);
    setTerminationReason("");
    setTerminationConfirmed(false);
    setTerminationError("");
  }

  function openTerminationDialog(challenge: AdminStudyChallengeDetail) {
    if (
      enrollmentOpen ||
      terminationInFlightRef.current ||
      !canTerminateChallenge(challenge)
    ) {
      return;
    }
    terminationSnapshotRef.current = challenge;
    setTerminationSnapshot(challenge);
    setTerminationReason("");
    setTerminationConfirmed(false);
    setTerminationError("");
    setActionNotice("");
    setCompletionNotice("");
  }

  function closeTerminationDialog() {
    if (terminating) return;
    resetTerminationDialog();
  }

  async function handleTerminateChallenge() {
    const snapshot = terminationSnapshotRef.current;
    const reasonNote = terminationReason.trim();
    if (
      !snapshot ||
      !terminationConfirmed ||
      !reasonNote ||
      reasonNote.length > TERMINATION_REASON_MAX_LENGTH ||
      terminationInFlightRef.current ||
      terminating
    ) {
      return;
    }

    terminationInFlightRef.current = true;
    listRequestRef.current += 1;
    detailRequestRef.current += 1;
    setTerminating(true);
    setTerminationError("");
    try {
      const termination = await terminateAdminStudyChallenge(snapshot.id, {
        confirmedTermination: true,
        reasonNote,
      });
      setDetail((current) =>
        current?.id === termination.challengeId
          ? applyTerminationToDetail(current, termination)
          : current,
      );
      setResult((current) => ({
        ...current,
        list: current.list.map((item) =>
          item.id === termination.challengeId
            ? applyTerminationToListItem(item, termination)
            : item,
        ),
      }));
      resetTerminationDialog();
      setActionNotice("");
      setCompletionNotice(
        terminationCompletedMessage(termination.status, snapshot.member.name),
      );
      void loadDetail(snapshot.id, true);
      void loadList(true);
    } catch (error) {
      const originalError =
        error instanceof Error
          ? error.message
          : "관리자 도전 종료를 처리하지 못했습니다.";
      setTerminationConfirmed(false);
      setTerminationError(originalError);

      const refreshed = await loadDetail(snapshot.id, true);
      void loadList(true);
      if (refreshed === undefined) return;
      if (refreshed === null) {
        setTerminationError(
          `${originalError} 최신 서버 상태도 확인하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.`,
        );
        return;
      }

      if (
        refreshed.status === "CANCELLED" ||
        refreshed.status === "WITHDRAWN"
      ) {
        resetTerminationDialog();
        setActionNotice("");
        setCompletionNotice(
          observedTerminationMessage(refreshed.status, refreshed.member.name),
        );
        return;
      }

      if (!canTerminateChallenge(refreshed)) {
        resetTerminationDialog();
        setCompletionNotice("");
        setActionNotice(terminationUnavailableMessage(refreshed));
        return;
      }

      setTerminationError(
        `${originalError} 서버에서 도전이 아직 진행 중인 것을 확인했습니다. 다시 시도해 주세요.`,
      );
    } finally {
      terminationInFlightRef.current = false;
      setTerminating(false);
    }
  }

  function resetSelection() {
    if (terminationInFlightRef.current) return;
    listRequestRef.current += 1;
    detailRequestRef.current += 1;
    resetTerminationDialog();
    selectedIdRef.current = "";
    setSelectedId("");
    setDetail(null);
    setDetailError("");
    setDetailLoading(false);
    setMobileView("list");
    setActionNotice("");
    setCompletionNotice("");
  }

  function changeSearch(value: string) {
    if (terminationInFlightRef.current) return;
    setSearchText(value);
    setPage(1);
    resetSelection();
  }

  function changeStatus(value: ChallengeStatusFilter) {
    if (terminationInFlightRef.current) return;
    setStatusFilter(value);
    setPage(1);
    resetSelection();
  }

  function changePage(nextPage: number) {
    if (terminationInFlightRef.current) return;
    setPage(nextPage);
    resetSelection();
  }

  function selectChallenge(challengeId: string) {
    if (terminationInFlightRef.current) return;
    if (challengeId !== selectedId) {
      resetTerminationDialog();
      selectedIdRef.current = challengeId;
      setSelectedId(challengeId);
      setDetail(null);
      setDetailError("");
      setActionNotice("");
      setCompletionNotice("");
    }
    setMobileView("detail");
    if (window.matchMedia("(max-width: 799px)").matches) {
      window.setTimeout(() => mobileBackRef.current?.focus(), 0);
    }
  }

  function showMobileList() {
    if (terminationInFlightRef.current) return;
    setMobileView("list");
    window.setTimeout(() => selectedRowRef.current?.focus(), 0);
  }

  function refreshWorkspace() {
    if (enrollmentOpen || terminationInFlightRef.current) return;
    void loadList();
    if (selectedId) void loadDetail(selectedId);
  }

  function openEnrollmentDialog() {
    if (
      enrollmentOpen ||
      visibleTerminationSnapshot ||
      terminationInFlightRef.current ||
      terminating
    ) {
      return;
    }
    resetTerminationDialog();
    setActionNotice("");
    setCompletionNotice("");
    setEnrollmentOpen(true);
  }

  function closeEnrollmentDialog() {
    setEnrollmentOpen(false);
  }

  function resolveEnrollment(
    memberName: string,
    outcome: "created" | "observed",
  ) {
    setEnrollmentOpen(false);
    setActionNotice("");
    setCompletionNotice(
      outcome === "created"
        ? `${memberName} 회원의 공부 도전을 등록했습니다.`
        : `${memberName} 회원이 최신 도전에 등록된 상태를 확인했습니다.`,
    );
    void loadList();
  }

  function changeTerminationReason(value: string) {
    setTerminationReason(value);
    setTerminationError("");
  }

  const visibleDetail = detail?.id === selectedId ? detail : null;

  return (
    <section
      className={`admin-challenge-page${mobileView === "detail" ? " is-mobile-detail" : ""}`}
    >
      <header className="admin-challenge-page-head">
        <div>
          <EmojiEventsOutlinedIcon />
          <span>
            <strong>도전 참여 현황</strong>
            <small>
              상담 관심 표시가 아닌 실제 참여 확정 기록만 표시합니다.
            </small>
          </span>
        </div>
        <span className="admin-challenge-total">총 {result.total}건</span>
        <button
          className="admin-challenge-enrollment-trigger"
          disabled={
            enrollmentOpen || Boolean(visibleTerminationSnapshot) || terminating
          }
          onClick={openEnrollmentDialog}
          ref={enrollmentTriggerRef}
          type="button"
        >
          <PersonAddAltOutlinedIcon />
          <span>회원 도전 등록</span>
        </button>
        <button
          aria-label="도전 현황 새로고침"
          disabled={
            listLoading || detailLoading || terminating || enrollmentOpen
          }
          onClick={refreshWorkspace}
          type="button"
        >
          <RefreshOutlinedIcon />
          <span>새로고침</span>
        </button>
      </header>

      {actionNotice && (
        <p
          className="admin-challenge-action-notice"
          ref={actionNoticeRef}
          role="status"
          tabIndex={-1}
        >
          {actionNotice}
        </p>
      )}

      {completionNotice && (
        <p
          className="admin-challenge-completion-notice"
          ref={completionNoticeRef}
          role="status"
          tabIndex={-1}
        >
          {completionNotice}
        </p>
      )}

      <div className="admin-challenge-layout">
        <AdminChallengeDirectory
          error={listError}
          loading={listLoading}
          onPageChange={changePage}
          onSearchChange={changeSearch}
          onSelect={selectChallenge}
          onStatusChange={changeStatus}
          result={result}
          searchText={searchText}
          selectedId={selectedId}
          selectedRowRef={selectedRowRef}
          statusFilter={statusFilter}
        />
        <AdminChallengeDetail
          detail={visibleDetail}
          detailError={detailError}
          detailLoading={detailLoading}
          hasActionNotice={Boolean(actionNotice)}
          listLoading={listLoading}
          mobileBackRef={mobileBackRef}
          onBack={showMobileList}
          onRequestTermination={openTerminationDialog}
          onRetry={(challengeId) => void loadDetail(challengeId)}
          selectedSummary={selectedSummary}
          terminating={terminating}
          terminationTriggerRef={terminationTriggerRef}
        />
      </div>

      {visibleTerminationSnapshot && (
        <AdminChallengeTerminationDialog
          confirmed={terminationConfirmed}
          error={terminationError}
          memberName={visibleTerminationSnapshot.member.name}
          onConfirmedChange={setTerminationConfirmed}
          onReasonChange={changeTerminationReason}
          onRequestClose={closeTerminationDialog}
          onSubmit={() => void handleTerminateChallenge()}
          periodLabel={periodText(
            visibleTerminationSnapshot.startsAt,
            visibleTerminationSnapshot.endsAtExclusive,
          )}
          reason={terminationReason}
          reasonMaxLength={TERMINATION_REASON_MAX_LENGTH}
          returnFocusRef={terminationTriggerRef}
          submitting={terminating}
        />
      )}

      {enrollmentOpen && (
        <AdminChallengeEnrollmentDialog
          onRequestClose={closeEnrollmentDialog}
          onResolved={resolveEnrollment}
          returnFocusRef={enrollmentTriggerRef}
        />
      )}
    </section>
  );
}
