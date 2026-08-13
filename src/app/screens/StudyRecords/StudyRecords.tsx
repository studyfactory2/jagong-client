import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AppShell from "../../components/ui/AppShell";
import { getMyMonthlyStudyReport } from "../../services/study-statistics.service";
import type {
  MonthlyStudyDay,
  MonthlyStudyReport,
  MonthlyStudyWeek,
} from "../../../lib/types";
import StudyChallengePanel from "./StudyChallengePanel";
import "./study-records.css";

type ResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: string;
};

type CalendarCell = MonthlyStudyDay | null;

const SEOUL_TIME_ZONE = "Asia/Seoul";
const REFRESH_INTERVAL_MS = 60000;
const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

const countedThroughFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: SEOUL_TIME_ZONE,
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function requestError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function seoulDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function currentSeoulMonth(): string {
  return seoulDateKey().slice(0, 7);
}

function parseDateKey(value: string): {
  year: number;
  month: number;
  day: number;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  return { year, month, day };
}

function shiftMonth(month: string, offset: number): string {
  const parsed = parseDateKey(`${month}-01`);
  if (!parsed) return currentSeoulMonth();
  const monthIndex = parsed.year * 12 + parsed.month - 1 + offset;
  const nextYear = Math.floor(monthIndex / 12);
  const nextMonth = (monthIndex % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function mondayFirstWeekday(date: string): number {
  const parsed = parseDateKey(date);
  if (!parsed) return 0;
  const weekday = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day),
  ).getUTCDay();
  return (weekday + 6) % 7;
}

function calendarRows(days: MonthlyStudyDay[]): CalendarCell[][] {
  if (days.length === 0) return [];
  const ordered = [...days].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const cells: CalendarCell[] = [
    ...Array.from<CalendarCell>({
      length: mondayFirstWeekday(ordered[0].date),
    }).fill(null),
    ...ordered,
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: CalendarCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    rows.push(cells.slice(index, index + 7));
  }
  return rows;
}

function safeSeconds(value?: number): number | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

function formatClockDuration(value?: number): string {
  const seconds = safeSeconds(value);
  if (seconds === null) return "--";
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function formatLongDuration(value?: number): string {
  const seconds = safeSeconds(value);
  if (seconds === null) return "집계 전";
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}시간 ${minutes}분`;
}

function monthLabel(month: string): string {
  const parsed = parseDateKey(`${month}-01`);
  if (!parsed) return month;
  return `${parsed.year}년 ${parsed.month}월`;
}

function dayLabel(date: string): string {
  const parsed = parseDateKey(date);
  if (!parsed) return date;
  return `${parsed.month}월 ${parsed.day}일`;
}

function weekDateLabel(date: string): string {
  const parsed = parseDateKey(date);
  if (!parsed) return date;
  const weekday = WEEKDAYS[mondayFirstWeekday(date)];
  const month = String(parsed.month).padStart(2, "0");
  const day = String(parsed.day).padStart(2, "0");
  return `${month}월 ${day}일(${weekday})`;
}

function weekLabel(week: MonthlyStudyWeek): string {
  return `${weekDateLabel(week.startsOn)} – ${weekDateLabel(
    week.endsOnInclusive,
  )}`;
}

function countedThroughLabel(value?: string): string {
  if (!value) return "집계 기준 확인 중";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "집계 기준 확인 중";
  return `${countedThroughFormatter.format(date)} 기준`;
}

export default function StudyRecords() {
  const monthlyRequestRef = useRef(0);
  const [selectedMonth, setSelectedMonth] = useState(currentSeoulMonth);
  const [monthlyReport, setMonthlyReport] = useState<
    ResourceState<MonthlyStudyReport>
  >({ data: null, loading: true, error: "" });
  const [challengeRefreshToken, setChallengeRefreshToken] = useState(0);

  const refreshMonthlyReport = useCallback(async (month: string) => {
    const requestId = monthlyRequestRef.current + 1;
    monthlyRequestRef.current = requestId;
    setMonthlyReport((current) => ({
      data: current.data?.month === month ? current.data : null,
      loading: true,
      error: "",
    }));

    try {
      const data = await getMyMonthlyStudyReport(month);
      if (requestId !== monthlyRequestRef.current) return;
      if (data.month !== month) {
        throw new Error("선택한 달의 공부기록을 확인하지 못했습니다.");
      }
      setMonthlyReport({ data, loading: false, error: "" });
    } catch (error) {
      if (requestId !== monthlyRequestRef.current) return;
      setMonthlyReport((current) => ({
        data: current.data?.month === month ? current.data : null,
        loading: false,
        error: requestError(
          error,
          "월별 공부기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        ),
      }));
    }
  }, []);

  useEffect(() => {
    void refreshMonthlyReport(selectedMonth);
    const refreshTimer =
      selectedMonth === currentSeoulMonth()
        ? window.setInterval(() => {
            void refreshMonthlyReport(selectedMonth);
          }, REFRESH_INTERVAL_MS)
        : null;

    return () => {
      if (refreshTimer !== null) window.clearInterval(refreshTimer);
      monthlyRequestRef.current += 1;
    };
  }, [refreshMonthlyReport, selectedMonth]);

  const report =
    monthlyReport.data?.month === selectedMonth ? monthlyReport.data : null;
  const rows = useMemo(() => calendarRows(report?.days ?? []), [report?.days]);
  const today = seoulDateKey();
  const latestMonth = currentSeoulMonth();
  const canMoveNext = selectedMonth < latestMonth;

  function moveMonth(offset: number) {
    const nextMonth = shiftMonth(selectedMonth, offset);
    if (nextMonth > currentSeoulMonth()) return;
    setSelectedMonth(nextMonth);
  }

  function refreshAll() {
    void refreshMonthlyReport(selectedMonth);
    setChallengeRefreshToken((current) => current + 1);
  }

  return (
    <AppShell
      title="작업시간"
      wide
      footer={false}
      className="study-records-shell"
      actions={
        <button
          aria-label="작업시간 새로고침"
          className="study-records-refresh"
          disabled={monthlyReport.loading}
          onClick={refreshAll}
          type="button"
        >
          <RefreshRoundedIcon />
          <span>{monthlyReport.loading ? "반영 중" : "새로고침"}</span>
        </button>
      }
    >
      <div className="study-records-report">
        <section
          aria-busy={monthlyReport.loading}
          className="study-records-tracker"
        >
          {monthlyReport.error && (
            <div className="study-records-status is-error" role="alert">
              <span>
                {report
                  ? "최신 기록을 확인하지 못해 이전 기록을 표시합니다."
                  : monthlyReport.error}
              </span>
              <button
                disabled={monthlyReport.loading}
                onClick={() => void refreshMonthlyReport(selectedMonth)}
                type="button"
              >
                다시 불러오기
              </button>
            </div>
          )}

          {!report && monthlyReport.loading && (
            <p className="study-records-status" role="status">
              월별 작업시간을 불러오는 중입니다.
            </p>
          )}

          {report && (
            <>
              <section
                aria-label={`${monthLabel(selectedMonth)} 일별 작업 기록`}
                className="study-records-calendar-card"
              >
                <header className="study-records-section-heading">
                  <h2>
                    <KeyboardArrowDownRoundedIcon aria-hidden="true" />
                    일별 작업 기록
                  </h2>
                  <div className="study-records-month-navigation">
                    <button
                      aria-label="이전 달 보기"
                      onClick={() => moveMonth(-1)}
                      type="button"
                    >
                      <KeyboardArrowLeftRoundedIcon />
                    </button>
                    <strong>{monthLabel(selectedMonth)}</strong>
                    <button
                      aria-label="다음 달 보기"
                      disabled={!canMoveNext}
                      onClick={() => moveMonth(1)}
                      type="button"
                    >
                      <KeyboardArrowRightRoundedIcon />
                    </button>
                    <small>{countedThroughLabel(report.countedThroughAt)}</small>
                  </div>
                </header>

                <table className="study-records-calendar">
                  <thead>
                    <tr>
                      {WEEKDAYS.map((weekday) => (
                        <th key={weekday} scope="col">
                          {weekday}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIndex) => (
                      <tr key={`week-${rowIndex}`}>
                        {row.map((day, dayIndex) => {
                          if (!day) {
                            return (
                              <td
                                aria-hidden="true"
                                className="is-empty"
                                key={`empty-${rowIndex}-${dayIndex}`}
                              />
                            );
                          }

                          const parsed = parseDateKey(day.date);
                          const isFuture = day.date > today;
                          const isToday = day.date === today;
                          const hasStudy = day.studySeconds > 0;
                          const duration = isFuture
                            ? "—"
                            : formatClockDuration(day.studySeconds);
                          const accessibleDuration = isFuture
                            ? "아직 집계 전"
                            : formatLongDuration(day.studySeconds);

                          return (
                            <td
                              aria-label={`${dayLabel(
                                day.date,
                              )} 작업시간 ${accessibleDuration}`}
                              className={[
                                isToday ? "is-today" : "",
                                isFuture ? "is-future" : "",
                                hasStudy ? "has-study" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              key={day.date}
                            >
                              <time dateTime={day.date}>{parsed?.day}</time>
                              <strong>{duration}</strong>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="study-records-weekly-card">
                <header className="study-records-section-heading">
                  <h2>
                    <KeyboardArrowDownRoundedIcon aria-hidden="true" />
                    주간 작업기록
                  </h2>
                </header>
                <div
                  className="study-records-weekly-column-head"
                  aria-hidden="true"
                >
                  <span>날짜</span>
                  <span>공부시간</span>
                </div>
                <ol>
                  {report.weeks.map((week) => (
                    <li key={`${week.startsOn}-${week.endsOnInclusive}`}>
                      <span>{weekLabel(week)}</span>
                      <strong>{formatClockDuration(week.studySeconds)}</strong>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="study-records-month-total">
                <div>
                  <KeyboardArrowDownRoundedIcon aria-hidden="true" />
                  <span>이번달 총작업량</span>
                </div>
                <strong>{formatLongDuration(report.monthStudySeconds)}</strong>
              </section>
            </>
          )}
        </section>

        <StudyChallengePanel refreshToken={challengeRefreshToken} />
      </div>
    </AppShell>
  );
}
