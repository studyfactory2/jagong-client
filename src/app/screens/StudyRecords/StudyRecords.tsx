import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import QueryStatsOutlinedIcon from "@mui/icons-material/QueryStatsOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AppShell from "../../components/ui/AppShell";
import {
  getMyStudyStatistics,
  getWeeklyStudyLeaderboard,
} from "../../services/study-statistics.service";
import type {
  MyStudyStatistics,
  StudyDurationTotal,
  StudyStatisticsWindow,
  WeeklyStudyLeaderboard,
} from "../../../lib/types";
import StudyChallengePanel from "./StudyChallengePanel";
import "./study-records.css";

type ResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: string;
};

const SEOUL_TIME_ZONE = "Asia/Seoul";
const REFRESH_INTERVAL_MS = 60000;

const shortDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: SEOUL_TIME_ZONE,
  month: "numeric",
  day: "numeric",
});

const updatedTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: SEOUL_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

function formatStudyTime(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return "--";

  const safeSeconds = Math.max(0, seconds);
  if (safeSeconds > 0 && safeSeconds < 60) return "1분 미만";

  const totalMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

function formatPeriod(period?: StudyStatisticsWindow): string {
  if (!period) return "기간 확인 중";

  const startsAt = new Date(period.startsAt);
  const endsAt = new Date(period.endsAtExclusive);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return "기간 확인 중";
  }

  const inclusiveEnd = new Date(endsAt.getTime() - 1);
  const startText = shortDateFormatter.format(startsAt);
  const endText = shortDateFormatter.format(inclusiveEnd);
  return startText === endText ? startText : `${startText} – ${endText}`;
}

function formatUpdatedTime(value?: string): string {
  if (!value) return "집계 전";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "집계 전";
  return updatedTimeFormatter.format(date);
}

function formatUpdatedDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return shortDateFormatter.format(date);
}

function studyTimeParts(seconds?: number): {
  primary: string;
  secondary: string;
} {
  if (seconds === undefined || !Number.isFinite(seconds)) {
    return { primary: "--", secondary: "" };
  }

  const safeSeconds = Math.max(0, seconds);
  if (safeSeconds > 0 && safeSeconds < 60) {
    return { primary: "1분", secondary: "미만" };
  }

  const totalMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return { primary: `${minutes}분`, secondary: "" };
  return {
    primary: `${hours}시간`,
    secondary: minutes > 0 ? `${minutes}분` : "",
  };
}

function requestError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function sameWindow(
  left?: StudyStatisticsWindow,
  right?: StudyStatisticsWindow,
): boolean {
  if (!left || !right) return false;
  const leftStart = new Date(left.startsAt).getTime();
  const leftEnd = new Date(left.endsAtExclusive).getTime();
  const rightStart = new Date(right.startsAt).getTime();
  const rightEnd = new Date(right.endsAtExclusive).getTime();

  return (
    Number.isFinite(leftStart) &&
    Number.isFinite(leftEnd) &&
    leftStart === rightStart &&
    leftEnd === rightEnd
  );
}

export default function StudyRecords() {
  const statisticsRequestRef = useRef(0);
  const leaderboardRequestRef = useRef(0);
  const [statistics, setStatistics] = useState<
    ResourceState<MyStudyStatistics>
  >({ data: null, loading: true, error: "" });
  const [leaderboard, setLeaderboard] = useState<
    ResourceState<WeeklyStudyLeaderboard>
  >({ data: null, loading: true, error: "" });
  const [challengeRefreshToken, setChallengeRefreshToken] = useState(0);

  const refreshStatistics = useCallback(async () => {
    const requestId = statisticsRequestRef.current + 1;
    statisticsRequestRef.current = requestId;
    setStatistics((current) => ({ ...current, loading: true, error: "" }));

    try {
      const data = await getMyStudyStatistics();
      if (requestId !== statisticsRequestRef.current) return;
      setStatistics({ data, loading: false, error: "" });
    } catch (error) {
      if (requestId !== statisticsRequestRef.current) return;
      setStatistics((current) => ({
        ...current,
        loading: false,
        error: requestError(
          error,
          "공부기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        ),
      }));
    }
  }, []);

  const refreshLeaderboard = useCallback(async () => {
    const requestId = leaderboardRequestRef.current + 1;
    leaderboardRequestRef.current = requestId;
    setLeaderboard((current) => ({ ...current, loading: true, error: "" }));

    try {
      const data = await getWeeklyStudyLeaderboard();
      if (requestId !== leaderboardRequestRef.current) return;
      setLeaderboard({ data, loading: false, error: "" });
    } catch (error) {
      if (requestId !== leaderboardRequestRef.current) return;
      setLeaderboard((current) => ({
        ...current,
        loading: false,
        error: requestError(
          error,
          "주간 순위를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        ),
      }));
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void refreshStatistics();
      void refreshLeaderboard();
    }, 0);
    const refreshTimer = window.setInterval(() => {
      void refreshStatistics();
      void refreshLeaderboard();
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
      statisticsRequestRef.current += 1;
      leaderboardRequestRef.current += 1;
    };
  }, [refreshLeaderboard, refreshStatistics]);

  const metrics: Array<{
    key: "today" | "currentWeek" | "currentMonth";
    label: string;
    value?: StudyDurationTotal;
  }> = [
    {
      key: "today",
      label: "오늘",
      value: statistics.data?.today,
    },
    {
      key: "currentWeek",
      label: "이번 주",
      value: statistics.data?.currentWeek,
    },
    {
      key: "currentMonth",
      label: "이번 달",
      value: statistics.data?.currentMonth,
    },
  ];

  const myWeeklyRank =
    leaderboard.data?.members.find((member) => member.isMe) ?? null;
  const positiveMemberCount =
    leaderboard.data?.members.filter(
      (member) =>
        Number.isFinite(member.studySeconds) && member.studySeconds > 0,
    ).length ?? 0;
  const weeklyWindowsMatch =
    !statistics.data ||
    !leaderboard.data ||
    sameWindow(statistics.data.currentWeek, leaderboard.data.window);
  const generatedAt =
    statistics.data?.generatedAt ?? leaderboard.data?.generatedAt;
  const refreshing = statistics.loading || leaderboard.loading;

  function refreshAll() {
    void refreshStatistics();
    void refreshLeaderboard();
    setChallengeRefreshToken((current) => current + 1);
  }

  return (
    <AppShell
      title="공부기록"
      wide
      footer={false}
      className="study-records-shell"
      actions={
        <button
          aria-label="공부기록 새로고침"
          className="study-records-refresh"
          disabled={refreshing}
          onClick={refreshAll}
          type="button"
        >
          <RefreshRoundedIcon />
          <span>{refreshing ? "반영 중" : "새로고침"}</span>
        </button>
      }
    >
      <div className="study-records-report">
        <div className="study-records-banner-stack">
          <section
            aria-busy={refreshing}
            className="study-records-banner"
          >
            <div className="study-records-banner-copy">
              <span className="study-records-banner-icon">
                <QueryStatsOutlinedIcon />
              </span>
              <div>
                <h2>나의 공부시간 리포트</h2>
                <p>실제로 공부 상태로 기록된 시간을 확인합니다.</p>
              </div>
            </div>
            <div className="study-records-updated">
              <span>최근 집계</span>
              <strong>{formatUpdatedTime(generatedAt)}</strong>
              {formatUpdatedDate(generatedAt) && (
                <small>{formatUpdatedDate(generatedAt)}</small>
              )}
            </div>
          </section>

          {!statistics.data && statistics.loading && (
            <p className="study-records-status" role="status">
              공부기록을 불러오는 중입니다.
            </p>
          )}

          {statistics.error && (
            <div className="study-records-status is-error" role="alert">
              <span>
                {statistics.data
                  ? "최신 공부기록을 확인하지 못해 이전 기록을 표시합니다."
                  : statistics.error}
              </span>
              <button
                disabled={statistics.loading}
                onClick={() => void refreshStatistics()}
                type="button"
              >
                다시 불러오기
              </button>
            </div>
          )}
        </div>

        <StudyChallengePanel refreshToken={challengeRefreshToken} />

        <section
          aria-busy={statistics.loading}
          aria-label="기간별 실제 공부시간"
          className="study-records-metrics"
        >
          {metrics.map((metric) => {
            const time = studyTimeParts(metric.value?.studySeconds);
            return (
              <article
                aria-label={`${metric.label} 공부시간 ${formatStudyTime(
                  metric.value?.studySeconds,
                )}`}
                className={`is-${metric.key}`}
                key={metric.key}
              >
                <h2>{metric.label}</h2>
                <div className="study-records-duration">
                  <strong>{time.primary}</strong>
                  {time.secondary && <em>{time.secondary}</em>}
                </div>
                <small>{formatPeriod(metric.value)}</small>
              </article>
            );
          })}
        </section>

        <section
          aria-busy={leaderboard.loading}
          className="study-records-rank"
        >
          <header>
            <div>
              <h2>이번 주 내 순위</h2>
              <small>{formatPeriod(leaderboard.data?.window)}</small>
            </div>
            <span aria-hidden="true">
              <EmojiEventsOutlinedIcon />
            </span>
          </header>

          {!leaderboard.data && leaderboard.loading ? (
            <p className="study-records-rank-state" role="status">
              주간 순위를 확인하는 중입니다.
            </p>
          ) : leaderboard.error && !leaderboard.data ? (
            <div className="study-records-rank-state is-error" role="alert">
              <p>{leaderboard.error}</p>
              <button
                disabled={leaderboard.loading}
                onClick={() => void refreshLeaderboard()}
                type="button"
              >
                다시 불러오기
              </button>
            </div>
          ) : !weeklyWindowsMatch ? (
            <div className="study-records-rank-state">
              <p>주간 공부시간과 순위의 집계 기준을 맞추는 중입니다.</p>
              <button onClick={refreshAll} type="button">
                새로고침
              </button>
            </div>
          ) : !myWeeklyRank ||
            !Number.isFinite(myWeeklyRank.studySeconds) ||
            myWeeklyRank.studySeconds <= 0 ? (
            <div className="study-records-rank-result is-empty">
              <div>
                <strong>집계 전</strong>
                <p>공부시간이 기록되면 주간 순위가 표시됩니다.</p>
              </div>
              <div className="study-records-rank-time">
                <span>이번 주 공부시간</span>
                <strong>
                  {formatStudyTime(statistics.data?.currentWeek.studySeconds)}
                </strong>
              </div>
            </div>
          ) : (
            <div className="study-records-rank-result">
              <div>
                <strong>{myWeeklyRank.rank}위</strong>
                <p>같은 지점에서 기록된 {positiveMemberCount}명 중</p>
              </div>
              <div className="study-records-rank-time">
                <span>이번 주 공부시간</span>
                <strong>{formatStudyTime(myWeeklyRank.studySeconds)}</strong>
              </div>
            </div>
          )}

          {leaderboard.error && leaderboard.data && (
            <p className="study-records-rank-stale" role="status">
              최신 순위를 확인하지 못해 이전 순위를 표시합니다.
            </p>
          )}
        </section>

        <aside className="study-records-guide">
          <h2>집계 기준</h2>
          <ul>
            <li>휴식 상태는 공부시간에서 제외됩니다.</li>
            <li>하루·주·월은 대한민국 표준시를 기준으로 계산됩니다.</li>
            <li>이번 주는 월요일부터 일요일까지입니다.</li>
          </ul>
          <p>공부 중에는 약 1분마다 최신 기록을 다시 확인합니다.</p>
        </aside>

        <Link
          className="study-records-fame-link"
          to="/waiting-room"
        >
          이번 주 명예의 전당 보기
        </Link>
      </div>
    </AppShell>
  );
}
