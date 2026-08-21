import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AdminStudyChallengeDetail,
  AdminStudyChallengeDetailWeek,
  AdminStudyChallengeListItem,
  AdminStudyChallengeListResult,
  StudyChallengeStatus,
} from "../../../lib/types";
import {
  getAdminStudyChallenge,
  getAdminStudyChallenges,
} from "../../services/study-challenge.service";
import AdminPager from "./AdminPager";

type ChallengeStatusFilter = "ALL" | StudyChallengeStatus;

const PAGE_LIMIT = 12;
const SEARCH_DELAY_MS = 350;
const DETAIL_POLL_INTERVAL_MS = 60000;

const EMPTY_RESULT: AdminStudyChallengeListResult = {
  list: [],
  total: 0,
  page: 1,
  limit: PAGE_LIMIT,
  totalPages: 1,
  generatedAt: "",
};

const STATUS_OPTIONS: Array<{
  value: ChallengeStatusFilter;
  label: string;
}> = [
  { value: "ALL", label: "전체 상태" },
  { value: "SCHEDULED", label: "참여 예정" },
  { value: "ACTIVE", label: "진행 중" },
  { value: "PASSED", label: "성공" },
  { value: "FAILED", label: "실패" },
  { value: "CANCELLED", label: "취소" },
];

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

function dateTimeText(value: string | null | undefined): string {
  const date = validDate(value);
  return date ? challengeDateTimeFormatter.format(date) : "-";
}

function periodText(startsAt: string, endsAtExclusive: string): string {
  const start = validDate(startsAt);
  const exclusiveEnd = validDate(endsAtExclusive);
  if (!start || !exclusiveEnd) return "기간 확인 필요";
  const inclusiveEnd = new Date(exclusiveEnd.getTime() - 1);
  return `${challengeDateFormatter.format(start)} – ${challengeDateFormatter.format(inclusiveEnd)}`;
}

function durationText(seconds: number | null | undefined): string {
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

function targetText(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "목표 확인 필요";
  const hours = seconds / 3600;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}시간`;
}

function statusLabel(status: StudyChallengeStatus): string {
  if (status === "SCHEDULED") return "참여 예정";
  if (status === "ACTIVE") return "진행 중";
  if (status === "PASSED") return "성공";
  if (status === "FAILED") return "실패";
  return "취소";
}

function eligibilityLabel(
  eligibilityKind: AdminStudyChallengeListItem["eligibilityKind"],
): string {
  if (eligibilityKind === "PAYMENT") return "결제 이용권";
  if (eligibilityKind === "REWARD") return "도전 보상 이용권";
  return "자격 출처 확인 필요";
}

function weekStatusLabel(
  week: AdminStudyChallengeDetailWeek,
  currentWeekNumber: number | null,
): string {
  if (week.status === "PASSED") return "달성";
  if (week.status === "FAILED") return "미달";
  return week.weekNumber === currentWeekNumber ? "진행 중" : "대기";
}

function weekStudySeconds(
  detail: AdminStudyChallengeDetail,
  week: AdminStudyChallengeDetailWeek,
): number | null {
  return detail.currentWeekProgress?.weekNumber === week.weekNumber
    ? detail.currentWeekProgress.studySeconds
    : week.studySeconds;
}

function memberMeta(item: AdminStudyChallengeListItem): string {
  return [item.member.branch?.name, item.member.examType, item.member.phone]
    .filter(Boolean)
    .join(" · ");
}

export default function Challenges() {
  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);
  const mobileBackRef = useRef<HTMLButtonElement | null>(null);
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

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(searchText.trim()),
      SEARCH_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const loadList = useCallback(async (silent = false) => {
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
      setResult(next);
      if (!next.list.length) {
        detailRequestRef.current += 1;
        setDetail(null);
        setDetailError("");
        setDetailLoading(false);
      }
      setSelectedId((current) =>
        next.list.some((item) => item.id === current)
          ? current
          : (next.list[0]?.id ?? ""),
      );
    } catch (error) {
      if (requestId !== listRequestRef.current || silent) return;
      detailRequestRef.current += 1;
      setResult(EMPTY_RESULT);
      setSelectedId("");
      setDetail(null);
      setDetailError("");
      setDetailLoading(false);
      setListError(
        error instanceof Error
          ? error.message
          : "도전 참여자 목록을 불러오지 못했습니다.",
      );
    } finally {
      if (!silent && requestId === listRequestRef.current) {
        setListLoading(false);
      }
    }
  }, [debouncedSearch, page, statusFilter]);

  const loadDetail = useCallback(async (
    challengeId: string,
    silent = false,
  ) => {
    const requestId = ++detailRequestRef.current;
    if (!silent) {
      setDetailLoading(true);
      setDetailError("");
      setDetail(null);
    }
    try {
      const next = await getAdminStudyChallenge(challengeId);
      if (requestId !== detailRequestRef.current) return;
      setDetail(next);
      setDetailError("");
    } catch (error) {
      if (requestId !== detailRequestRef.current || silent) return;
      setDetailError(
        error instanceof Error
          ? error.message
          : "도전 상세 정보를 불러오지 못했습니다.",
      );
    } finally {
      if (!silent && requestId === detailRequestRef.current) {
        setDetailLoading(false);
      }
    }
  }, []);

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

  const selectedSummary = useMemo(
    () => result.list.find((item) => item.id === selectedId) ?? null,
    [result.list, selectedId],
  );

  function resetSelection() {
    listRequestRef.current += 1;
    detailRequestRef.current += 1;
    setSelectedId("");
    setDetail(null);
    setDetailError("");
    setDetailLoading(false);
    setMobileView("list");
  }

  function changeSearch(value: string) {
    setSearchText(value);
    setPage(1);
    resetSelection();
  }

  function changeStatus(value: ChallengeStatusFilter) {
    setStatusFilter(value);
    setPage(1);
    resetSelection();
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    resetSelection();
  }

  function selectChallenge(challengeId: string) {
    if (challengeId !== selectedId) {
      setSelectedId(challengeId);
      setDetail(null);
      setDetailError("");
    }
    setMobileView("detail");
    if (window.matchMedia("(max-width: 799px)").matches) {
      window.setTimeout(() => mobileBackRef.current?.focus(), 0);
    }
  }

  function showMobileList() {
    setMobileView("list");
    window.setTimeout(() => selectedRowRef.current?.focus(), 0);
  }

  function refreshWorkspace() {
    void loadList();
    if (selectedId) void loadDetail(selectedId);
  }

  const detailTarget = detail?.weeklyTargetSeconds ?? 0;
  const currentStudySeconds = detail?.currentWeekProgress?.studySeconds ?? 0;
  const detailMatchesSelection = detail?.id === selectedId;

  return (
    <section
      className={`admin-challenge-page${mobileView === "detail" ? " is-mobile-detail" : ""}`}
    >
      <header className="admin-challenge-page-head">
        <div>
          <EmojiEventsOutlinedIcon />
          <span>
            <strong>도전 참여 현황</strong>
            <small>상담 관심 표시가 아닌 실제 참여 확정 기록만 표시합니다.</small>
          </span>
        </div>
        <span className="admin-challenge-total">총 {result.total}건</span>
        <button
          aria-label="도전 현황 새로고침"
          disabled={listLoading || detailLoading}
          onClick={refreshWorkspace}
          type="button"
        >
          <RefreshOutlinedIcon />
          <span>새로고침</span>
        </button>
      </header>

      <div className="admin-challenge-layout">
        <aside className="admin-challenge-directory">
          <div className="admin-challenge-filters">
            <label className="admin-challenge-search">
              <span>참여자 검색</span>
              <div>
                <SearchOutlinedIcon />
                <input
                  onChange={(event) => changeSearch(event.target.value)}
                  placeholder="회원명, 연락처 또는 시험"
                  type="search"
                  value={searchText}
                />
              </div>
            </label>
            <label className="admin-challenge-status-filter">
              <span>도전 상태</span>
              <select
                onChange={(event) =>
                  changeStatus(event.target.value as ChallengeStatusFilter)
                }
                value={statusFilter}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {listError && (
            <p className="admin-challenge-error" role="alert">
              {listError}
            </p>
          )}

          <div
            aria-busy={listLoading}
            aria-label="도전 참여자 목록"
            className="admin-challenge-list"
          >
            {listLoading && !result.list.length && (
              <span className="admin-challenge-list-state">
                참여자 목록을 불러오는 중입니다.
              </span>
            )}

            {!listLoading && !listError && !result.list.length && (
              <span className="admin-challenge-list-state">
                조건에 맞는 도전 참여자가 없습니다.
              </span>
            )}

            {result.list.map((item) => (
              <button
                aria-pressed={item.id === selectedId}
                className={`admin-challenge-list-item${item.id === selectedId ? " is-selected" : ""}`}
                key={item.id}
                onClick={() => selectChallenge(item.id)}
                ref={item.id === selectedId ? selectedRowRef : undefined}
                type="button"
              >
                <span aria-hidden="true" className="admin-challenge-avatar">
                  {item.member.name.slice(0, 1)}
                </span>
                <span className="admin-challenge-list-person">
                  <strong>{item.member.name}</strong>
                  <small>{memberMeta(item) || "회원 정보 없음"}</small>
                </span>
                <em
                  className={`admin-challenge-status is-${item.status.toLowerCase()}`}
                >
                  {statusLabel(item.status)}
                </em>
                <span className="admin-challenge-list-period">
                  {periodText(item.startsAt, item.endsAtExclusive)}
                </span>
                <span className="admin-challenge-list-progress">
                  <b>
                    달성 {item.weekSummary.passed} · 미달 {item.weekSummary.failed}
                    · 대기 {item.weekSummary.pending}
                  </b>
                  <small>
                    {item.currentWeekNumber
                      ? `현재 ${item.currentWeekNumber}주차`
                      : `정산 ${durationText(item.weekSummary.finalizedStudySeconds)}`}
                  </small>
                </span>
                <i aria-hidden="true">›</i>
              </button>
            ))}
          </div>

          <AdminPager meta={result} numbered onPageChange={changePage} />
        </aside>

        <article className="admin-challenge-detail">
          <button
            className="admin-challenge-mobile-back"
            onClick={showMobileList}
            ref={mobileBackRef}
            type="button"
          >
            <ArrowBackOutlinedIcon /> 참여자 목록
          </button>

          {!selectedSummary && !listLoading && (
            <div className="admin-challenge-detail-state">
              <EmojiEventsOutlinedIcon />
              <strong>확인할 참여자를 선택해 주세요.</strong>
              <span>도전 기간과 주차별 공부시간을 확인할 수 있습니다.</span>
            </div>
          )}

          {selectedSummary && detailLoading && (
            <div className="admin-challenge-detail-state" aria-busy="true">
              <strong>도전 상세 정보를 불러오는 중입니다.</strong>
            </div>
          )}

          {selectedSummary && detailError && !detailLoading && (
            <div className="admin-challenge-detail-state is-error" role="alert">
              <strong>{detailError}</strong>
              <button
                onClick={() => void loadDetail(selectedSummary.id)}
                type="button"
              >
                다시 불러오기
              </button>
            </div>
          )}

          {detailMatchesSelection && detail && !detailLoading && (
            <>
              <header className="admin-challenge-detail-head">
                <div>
                  <span aria-hidden="true" className="admin-challenge-avatar">
                    {detail.member.name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{detail.member.name}</strong>
                    <small>
                      {[
                        detail.member.branch?.name,
                        detail.member.examType,
                        detail.member.phone,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "회원 정보 없음"}
                    </small>
                  </span>
                </div>
                <em
                  className={`admin-challenge-status is-${detail.status.toLowerCase()}`}
                >
                  {statusLabel(detail.status)}
                </em>
              </header>

              <dl className="admin-challenge-facts">
                <div>
                  <dt>도전 기간</dt>
                  <dd>{periodText(detail.startsAt, detail.endsAtExclusive)}</dd>
                </div>
                <div>
                  <dt>주간 목표</dt>
                  <dd>
                    {detail.requiredWeeks}주 · 매주 {targetText(detailTarget)}
                  </dd>
                </div>
                <div>
                  <dt>참여 확정</dt>
                  <dd>{dateTimeText(detail.confirmedAt)}</dd>
                </div>
                <div>
                  <dt>참여 자격</dt>
                  <dd>{eligibilityLabel(detail.eligibilityKind)}</dd>
                </div>
                <div>
                  <dt>규칙 버전</dt>
                  <dd>{detail.rulesVersion ?? "확인 필요"}</dd>
                </div>
                <div>
                  <dt>최종 정산</dt>
                  <dd>{dateTimeText(detail.finalizedAt)}</dd>
                </div>
              </dl>

              {detail.currentWeekProgress && (
                <section className="admin-challenge-live-progress">
                  <div>
                    <span>현재 {detail.currentWeekProgress.weekNumber}주차</span>
                    <strong>
                      {durationText(currentStudySeconds)} / {targetText(detailTarget)}
                    </strong>
                  </div>
                  <progress
                    aria-label={`${detail.currentWeekProgress.weekNumber}주차 공부시간 진행률`}
                    max={Math.max(1, detailTarget)}
                    value={Math.min(currentStudySeconds, Math.max(1, detailTarget))}
                  />
                  <small>
                    {dateTimeText(detail.currentWeekProgress.countedThroughAt)} 기준
                  </small>
                </section>
              )}

              <section className="admin-challenge-weeks">
                <header>
                  <strong>주차별 현황</strong>
                  <span>
                    달성 {detail.weekSummary.passed} · 미달 {detail.weekSummary.failed}
                    · 대기 {detail.weekSummary.pending}
                  </span>
                </header>
                <div>
                  {detail.weeks.map((week) => {
                    const seconds = weekStudySeconds(detail, week);
                    const current =
                      detail.currentWeekProgress?.weekNumber === week.weekNumber;
                    return (
                      <article
                        className={`${current ? "is-current " : ""}is-${week.status.toLowerCase()}`}
                        key={week.id}
                      >
                        <span className="admin-challenge-week-number">
                          {week.weekNumber}주차
                        </span>
                        <span className="admin-challenge-week-period">
                          {periodText(week.startsAt, week.endsAtExclusive)}
                        </span>
                        <strong>{durationText(seconds)}</strong>
                        <em>
                          {weekStatusLabel(week, detail.currentWeekNumber)}
                        </em>
                      </article>
                    );
                  })}
                </div>
              </section>

              <footer className="admin-challenge-detail-foot">
                상세 현황 {dateTimeText(detail.generatedAt)} 기준
              </footer>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
