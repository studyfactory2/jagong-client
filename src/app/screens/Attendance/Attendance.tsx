import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AppShell from "../../components/ui/AppShell";
import { getMyAttendance } from "../../services/attendance.service";
import { getTimetable } from "../../services/timetable.service";
import {
  getAttendanceArrivalDetail,
} from "../../utils/attendance-display";
import type {
  AttendanceRecord,
  AttendanceStatusName,
  TimetableSlot,
} from "../../../lib/types";
import "./attendance.css";

type AttendanceReport = {
  rangeKey: string;
  records: AttendanceRecord[];
};

type ResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: string;
};

type CalendarCell = string | null;

type StatusMeta = {
  className: string;
  glyph: string;
  label: string;
};

const SEOUL_TIME_ZONE = "Asia/Seoul";
const REFRESH_INTERVAL_MS = 60_000;
const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

const STATUS_META: Record<AttendanceStatusName, StatusMeta> = {
  PRESENT: { className: "is-present", glyph: "✓", label: "출석" },
  LATE: { className: "is-late", glyph: "!", label: "지각" },
  ABSENT: { className: "is-absent", glyph: "×", label: "결석" },
  EXCUSED: { className: "is-excused", glyph: "사", label: "사유 인정" },
};

const STATUS_PRIORITY: Record<AttendanceStatusName, number> = {
  PRESENT: 1,
  EXCUSED: 2,
  LATE: 3,
  ABSENT: 4,
};

function requestError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function seoulDateTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    secondOfDay:
      Number(part("hour")) * 3600 +
      Number(part("minute")) * 60 +
      Number(part("second")),
  };
}

function currentSeoulMonth(): string {
  return seoulDateTimeParts().date.slice(0, 7);
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
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function dateKeyFromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, offset: number): string {
  const parsed = parseDateKey(date);
  if (!parsed) return date;
  return dateKeyFromUtc(
    new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + offset)),
  );
}

function mondayFirstWeekday(date: string): number {
  const parsed = parseDateKey(date);
  if (!parsed) return 0;
  const weekday = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day),
  ).getUTCDay();
  return (weekday + 6) % 7;
}

function startOfWeek(date: string): string {
  return addDays(date, -mondayFirstWeekday(date));
}

function weekDates(date: string): string[] {
  const startsOn = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(startsOn, index));
}

function shiftMonth(month: string, offset: number): string {
  const parsed = parseDateKey(`${month}-01`);
  if (!parsed) return currentSeoulMonth();
  const monthIndex = parsed.year * 12 + parsed.month - 1 + offset;
  const year = Math.floor(monthIndex / 12);
  const nextMonth = (monthIndex % 12) + 1;
  return `${year}-${String(nextMonth).padStart(2, "0")}`;
}

function lastDateOfMonth(month: string): string {
  const parsed = parseDateKey(`${month}-01`);
  if (!parsed) return `${month}-01`;
  return dateKeyFromUtc(new Date(Date.UTC(parsed.year, parsed.month, 0)));
}

function visibleMonthRange(month: string): { from: string; to: string } {
  const first = `${month}-01`;
  const last = lastDateOfMonth(month);
  return {
    from: startOfWeek(first),
    to: addDays(last, 6 - mondayFirstWeekday(last)),
  };
}

function monthCalendarRows(month: string): CalendarCell[][] {
  const last = parseDateKey(lastDateOfMonth(month));
  if (!last) return [];
  const dates = Array.from(
    { length: last.day },
    (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`,
  );
  const cells: CalendarCell[] = [
    ...Array.from<CalendarCell>({
      length: mondayFirstWeekday(dates[0]),
    }).fill(null),
    ...dates,
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: CalendarCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    rows.push(cells.slice(index, index + 7));
  }
  return rows;
}

function monthLabel(month: string): string {
  const parsed = parseDateKey(`${month}-01`);
  return parsed ? `${parsed.year}년 ${parsed.month}월` : month;
}

function shortDateLabel(date: string): string {
  const parsed = parseDateKey(date);
  return parsed ? `${parsed.month}.${parsed.day}` : date;
}

function fullDateLabel(date: string): string {
  const parsed = parseDateKey(date);
  if (!parsed) return date;
  const weekday = WEEKDAYS[mondayFirstWeekday(date)];
  return `${parsed.month}월 ${parsed.day}일(${weekday})`;
}

function weekRangeLabel(dates: string[]): string {
  const first = dates[0];
  const last = dates[dates.length - 1];
  return first && last ? `${shortDateLabel(first)} – ${shortDateLabel(last)}` : "";
}

function apiDateKey(value: string): string {
  return value.slice(0, 10);
}

function isAttendanceStatus(value: string): value is AttendanceStatusName {
  return value in STATUS_META;
}

function isClockInSlot(slot: TimetableSlot): boolean {
  return slot.slot === 0 || slot.label.includes("출근");
}

function isWorkPeriodSlot(slot: TimetableSlot): boolean {
  return !slot.isBreak && !isClockInSlot(slot);
}

function highestPriorityStatus(
  records: AttendanceRecord[],
): AttendanceStatusName | null {
  let selected: AttendanceStatusName | null = null;
  records.forEach((record) => {
    if (!isAttendanceStatus(record.status)) return;
    if (!selected || STATUS_PRIORITY[record.status] > STATUS_PRIORITY[selected]) {
      selected = record.status;
    }
  });
  return selected;
}

function clockToSecond(value: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 3600 + minute * 60;
}

function missingStatusLabel(
  date: string,
  slot: TimetableSlot,
  today: string,
  nowSecond: number,
): string {
  if (date > today) return "예정";
  if (date < today) return "미기록";
  const startsAt = clockToSecond(slot.startTime);
  const endsAt = clockToSecond(slot.endTime);
  if (startsAt === null || endsAt === null) return "미기록";
  if (nowSecond < startsAt) return "예정";
  if (nowSecond < endsAt) return "확인 중";
  return "미기록";
}

function recordDescription(
  record: AttendanceRecord,
  periodNumber: number,
): string {
  const status = isAttendanceStatus(record.status)
    ? STATUS_META[record.status].label
    : "확인 필요";
  const details = [`${periodNumber}교시`, status];
  const arrival = getAttendanceArrivalDetail(record);
  if (arrival?.lateDuration) details.push(`${arrival.lateDuration} 늦게 입실`);
  if (arrival?.firstStudyClock) {
    details.push(`공부 시작 ${arrival.firstStudyClock}`);
  }
  if (record.status === "EXCUSED") {
    const reason = record.reason?.trim() || record.reasonType?.trim();
    if (reason) details.push(reason);
  }
  return details.join(" · ");
}

export default function Attendance() {
  const attendanceRequestRef = useRef(0);
  const timetableRequestRef = useRef(0);
  const [selectedMonth, setSelectedMonth] = useState(currentSeoulMonth);
  const [selectedDate, setSelectedDate] = useState(
    () => seoulDateTimeParts().date,
  );
  const [attendance, setAttendance] = useState<
    ResourceState<AttendanceReport>
  >({ data: null, loading: true, error: "" });
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [timetableLoading, setTimetableLoading] = useState(true);
  const [timetableError, setTimetableError] = useState("");
  const [now, setNow] = useState(() => new Date());

  const refreshAttendance = useCallback(async (month: string) => {
    const { from, to } = visibleMonthRange(month);
    const rangeKey = `${from}:${to}`;
    const requestId = attendanceRequestRef.current + 1;
    attendanceRequestRef.current = requestId;
    setAttendance((current) => ({
      data: current.data?.rangeKey === rangeKey ? current.data : null,
      loading: true,
      error: "",
    }));

    try {
      const records = await getMyAttendance({ from, to });
      if (requestId !== attendanceRequestRef.current) return;
      setAttendance({
        data: { rangeKey, records },
        loading: false,
        error: "",
      });
    } catch (error) {
      if (requestId !== attendanceRequestRef.current) return;
      setAttendance((current) => ({
        data: current.data?.rangeKey === rangeKey ? current.data : null,
        loading: false,
        error: requestError(
          error,
          "출석 기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        ),
      }));
    }
  }, []);

  const refreshTimetable = useCallback(async () => {
    const requestId = timetableRequestRef.current + 1;
    timetableRequestRef.current = requestId;
    setTimetableLoading(true);
    setTimetableError("");
    try {
      const timetable = await getTimetable();
      if (requestId !== timetableRequestRef.current) return;
      setSlots(timetable);
    } catch (error) {
      if (requestId !== timetableRequestRef.current) return;
      setTimetableError(
        requestError(error, "교시 정보를 불러오지 못했습니다."),
      );
    } finally {
      if (requestId === timetableRequestRef.current) {
        setTimetableLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshTimetable();
    return () => {
      timetableRequestRef.current += 1;
    };
  }, [refreshTimetable]);

  useEffect(() => {
    void refreshAttendance(selectedMonth);
    const refreshTimer =
      selectedMonth === currentSeoulMonth()
        ? window.setInterval(() => {
            setNow(new Date());
            void refreshAttendance(selectedMonth);
          }, REFRESH_INTERVAL_MS)
        : null;

    const refreshVisibleMonth = () => {
      if (document.visibilityState !== "visible") return;
      setNow(new Date());
      void refreshAttendance(selectedMonth);
    };
    window.addEventListener("focus", refreshVisibleMonth);
    document.addEventListener("visibilitychange", refreshVisibleMonth);

    return () => {
      if (refreshTimer !== null) window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshVisibleMonth);
      document.removeEventListener("visibilitychange", refreshVisibleMonth);
      attendanceRequestRef.current += 1;
    };
  }, [refreshAttendance, selectedMonth]);

  const range = visibleMonthRange(selectedMonth);
  const rangeKey = `${range.from}:${range.to}`;
  const report =
    attendance.data?.rangeKey === rangeKey ? attendance.data.records : null;
  const workPeriodSlots = useMemo(
    () =>
      slots
        .filter(isWorkPeriodSlot)
        .sort((left, right) => left.slot - right.slot)
        .slice(0, 7),
    [slots],
  );
  const workSlotNumbers = useMemo(
    () => new Set(workPeriodSlots.map((slot) => slot.slot)),
    [workPeriodSlots],
  );
  const recordsByDate = useMemo(() => {
    const grouped = new Map<string, AttendanceRecord[]>();
    (report ?? []).forEach((record) => {
      if (!workSlotNumbers.has(record.slot)) return;
      const date = apiDateKey(String(record.date));
      grouped.set(date, [...(grouped.get(date) ?? []), record]);
    });
    return grouped;
  }, [report, workSlotNumbers]);
  const recordsByDateAndSlot = useMemo(() => {
    const indexed = new Map<string, AttendanceRecord>();
    recordsByDate.forEach((records, date) => {
      records.forEach((record) => {
        indexed.set(`${date}:${record.slot}`, record);
      });
    });
    return indexed;
  }, [recordsByDate]);
  const calendarRows = useMemo(
    () => monthCalendarRows(selectedMonth),
    [selectedMonth],
  );
  const selectedWeekDates = useMemo(
    () => weekDates(selectedDate),
    [selectedDate],
  );
  const currentTime = useMemo(() => seoulDateTimeParts(now), [now]);
  const latestMonth = currentTime.date.slice(0, 7);
  const canMoveNext = selectedMonth < latestMonth;

  function moveMonth(offset: number) {
    const nextMonth = shiftMonth(selectedMonth, offset);
    if (nextMonth > currentSeoulMonth()) return;
    setSelectedMonth(nextMonth);
    setSelectedDate(
      nextMonth === currentSeoulMonth()
        ? seoulDateTimeParts().date
        : `${nextMonth}-01`,
    );
  }

  function refreshAll() {
    setNow(new Date());
    void refreshAttendance(selectedMonth);
    void refreshTimetable();
  }

  const isInitialLoading =
    (!report && attendance.loading) ||
    (workPeriodSlots.length === 0 && timetableLoading);
  const cannotRender = !report || workPeriodSlots.length === 0;

  return (
    <AppShell
      actions={
        <button
          aria-label="출석현황 새로고침"
          className="attendance-refresh"
          disabled={attendance.loading || timetableLoading}
          onClick={refreshAll}
          type="button"
        >
          <RefreshRoundedIcon aria-hidden="true" />
          <span>
            {attendance.loading || timetableLoading ? "반영 중" : "새로고침"}
          </span>
        </button>
      }
      className="attendance-shell"
      footer={false}
      title="출석현황"
      wide
    >
      <main className="attendance-report">
        {attendance.error && (
          <div className="attendance-status is-error" role="alert">
            <span>
              {report
                ? "최신 출석을 확인하지 못해 이전 기록을 표시합니다."
                : attendance.error}
            </span>
            <button
              disabled={attendance.loading}
              onClick={() => void refreshAttendance(selectedMonth)}
              type="button"
            >
              다시 불러오기
            </button>
          </div>
        )}

        {timetableError && (
          <div className="attendance-status is-error" role="alert">
            <span>{timetableError}</span>
            <button
              disabled={timetableLoading}
              onClick={() => void refreshTimetable()}
              type="button"
            >
              다시 불러오기
            </button>
          </div>
        )}

        {isInitialLoading && (
          <p className="attendance-status" role="status">
            출석현황을 불러오는 중입니다.
          </p>
        )}

        {!isInitialLoading && cannotRender && !attendance.error && !timetableError && (
          <p className="attendance-status is-error" role="alert">
            표시할 출석 또는 교시 정보를 확인하지 못했습니다.
          </p>
        )}

        {!cannotRender && (
          <>
            <section
              aria-busy={attendance.loading}
              aria-label={`${monthLabel(selectedMonth)} 월별 출석현황`}
              className="attendance-calendar-card"
            >
              <header className="attendance-section-heading">
                <h2>
                  <KeyboardArrowDownRoundedIcon aria-hidden="true" />
                  월별 출석현황
                </h2>
                <div className="attendance-month-navigation">
                  <button
                    aria-label="이전 달 보기"
                    onClick={() => moveMonth(-1)}
                    type="button"
                  >
                    <KeyboardArrowLeftRoundedIcon aria-hidden="true" />
                  </button>
                  <strong>{monthLabel(selectedMonth)}</strong>
                  <button
                    aria-label="다음 달 보기"
                    disabled={!canMoveNext}
                    onClick={() => moveMonth(1)}
                    type="button"
                  >
                    <KeyboardArrowRightRoundedIcon aria-hidden="true" />
                  </button>
                </div>
              </header>

              <table className="attendance-calendar">
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
                  {calendarRows.map((row, rowIndex) => (
                    <tr key={`calendar-week-${rowIndex}`}>
                      {row.map((date, dayIndex) => {
                        if (!date) {
                          return (
                            <td
                              aria-hidden="true"
                              className="is-empty"
                              key={`empty-${rowIndex}-${dayIndex}`}
                            />
                          );
                        }
                        const parsed = parseDateKey(date);
                        const dayStatus = highestPriorityStatus(
                          recordsByDate.get(date) ?? [],
                        );
                        const meta = dayStatus ? STATUS_META[dayStatus] : null;
                        const isToday = date === currentTime.date;
                        const isSelected = date === selectedDate;
                        const dateDescription = meta
                          ? `${fullDateLabel(date)} ${meta.label}`
                          : `${fullDateLabel(date)} 기록 없음`;

                        return (
                          <td
                            className={[
                              isToday ? "is-today" : "",
                              isSelected ? "is-selected" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={date}
                          >
                            <button
                              aria-label={`${dateDescription}. 해당 주 보기`}
                              aria-pressed={isSelected}
                              onClick={() => setSelectedDate(date)}
                              type="button"
                            >
                              <time dateTime={date}>{parsed?.day}</time>
                              {meta ? (
                                <span
                                  aria-hidden="true"
                                  className={`attendance-status-circle ${meta.className}`}
                                  title={meta.label}
                                >
                                  {meta.glyph}
                                </span>
                              ) : (
                                <span
                                  aria-hidden="true"
                                  className="attendance-status-circle is-neutral"
                                >
                                  ·
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="attendance-legend" aria-label="출석 상태 안내">
                {(Object.keys(STATUS_META) as AttendanceStatusName[]).map(
                  (status) => (
                    <span key={status}>
                      <i className={STATUS_META[status].className} />
                      {STATUS_META[status].label}
                    </span>
                  ),
                )}
                <span>
                  <i className="is-neutral" />예정·미기록
                </span>
              </div>
            </section>

            <section
              aria-label={`${weekRangeLabel(selectedWeekDates)} 주별 출석현황`}
              className="attendance-weekly-card"
            >
              <header className="attendance-section-heading">
                <h2>
                  <KeyboardArrowDownRoundedIcon aria-hidden="true" />
                  주별 출석현황
                </h2>
                <div className="attendance-selected-week">
                  <strong>{weekRangeLabel(selectedWeekDates)}</strong>
                  <small>{fullDateLabel(selectedDate)} 선택</small>
                </div>
              </header>

              <div className="attendance-weekly-scroll" tabIndex={0}>
                <table className="attendance-weekly-table">
                  <thead>
                    <tr>
                      <th scope="col">날짜</th>
                      {workPeriodSlots.map((slot, index) => (
                        <th key={slot.slot} scope="col">
                          {index + 1}교시
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedWeekDates.map((date, dayIndex) => (
                      <tr
                        className={date === selectedDate ? "is-selected" : ""}
                        key={date}
                      >
                        <th scope="row">
                          <span className="attendance-weekday-label">
                            <span>{WEEKDAYS[dayIndex]}</span>
                            <time dateTime={date}>{shortDateLabel(date)}</time>
                          </span>
                        </th>
                        {workPeriodSlots.map((slot, periodIndex) => {
                          const record = recordsByDateAndSlot.get(
                            `${date}:${slot.slot}`,
                          );
                          const status =
                            record && isAttendanceStatus(record.status)
                              ? record.status
                              : null;
                          const meta = status ? STATUS_META[status] : null;
                          const neutralLabel = missingStatusLabel(
                            date,
                            slot,
                            currentTime.date,
                            currentTime.secondOfDay,
                          );
                          const description = record
                            ? recordDescription(record, periodIndex + 1)
                            : `${periodIndex + 1}교시 · ${neutralLabel}`;

                          return (
                            <td
                              aria-label={`${fullDateLabel(date)} · ${description}`}
                              key={slot.slot}
                              title={description}
                            >
                              <span
                                aria-hidden="true"
                                className={`attendance-period-status ${
                                  meta?.className ?? "is-neutral"
                                }`}
                              >
                                <b>{meta?.glyph ?? "·"}</b>
                                <small>{meta?.label ?? neutralLabel}</small>
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
