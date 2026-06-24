import { useEffect, useMemo, useState } from "react";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import HourglassBottomOutlinedIcon from "@mui/icons-material/HourglassBottomOutlined";
import AppShell from "../../components/ui/AppShell";
import { getMyAttendance } from "../../services/attendance.service";
import { getTimetable } from "../../services/timetable.service";
import type {
  AttendanceRecord,
  AttendanceStatusName,
  TimetableSlot,
} from "../../../lib/types";
import "./attendance.css";

type AttendanceView = "daily" | "weekly" | "monthly";

const STATUS_TEXT: Record<AttendanceStatusName, string> = {
  PRESENT: "출석",
  LATE: "지각",
  ABSENT: "결석",
  EXCUSED: "인정",
};

const STATUS_CLASS: Record<AttendanceStatusName, string> = {
  PRESENT: "is-present",
  LATE: "is-late",
  ABSENT: "is-absent",
  EXCUSED: "is-excused",
};

function dateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const todayKey = () => dateKey(new Date());

function monthKey(value: Date) {
  return dateKey(value).slice(0, 7);
}

function startOfWeek(value: Date) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfWeek(value: Date) {
  const date = startOfWeek(value);
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
}

function formatDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(date);
}

function formatRange(start: Date, end: Date) {
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function statusText(status?: string) {
  return STATUS_TEXT[(status as AttendanceStatusName) ?? "PRESENT"] ?? "확인";
}

function statusClass(status?: string) {
  return STATUS_CLASS[(status as AttendanceStatusName) ?? "PRESENT"] ?? "";
}

function slotLabel(slots: TimetableSlot[], slot: number) {
  return slots.find((item) => item.slot === slot)?.label ?? `${slot}교시`;
}

export default function Attendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [view, setView] = useState<AttendanceView>("daily");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const now = useMemo(() => new Date(), []);
  const currentMonth = monthKey(now);
  const weekStart = useMemo(() => startOfWeek(now), [now]);
  const weekEnd = useMemo(() => endOfWeek(now), [now]);
  const weekStartKey = dateKey(weekStart);
  const weekEndKey = dateKey(weekEnd);

  useEffect(() => {
    async function load() {
      setError("");
      setLoading(true);
      try {
        const [attendanceData, timetableData] = await Promise.all([
          getMyAttendance(),
          getTimetable(),
        ]);
        setRecords(attendanceData);
        setSlots(timetableData);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "출석 정보를 불러오지 못했습니다.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const monthRecords = useMemo(
    () =>
      records
        .filter((record) => String(record.date).slice(0, 7) === currentMonth)
        .sort((a, b) => {
          const dateOrder = String(b.date).localeCompare(String(a.date));
          if (dateOrder !== 0) return dateOrder;
          return a.slot - b.slot;
        }),
    [currentMonth, records],
  );

  const todayRecords = useMemo(
    () =>
      monthRecords.filter(
        (record) => String(record.date).slice(0, 10) === todayKey(),
      ),
    [monthRecords],
  );

  const weekRecords = useMemo(
    () =>
      records
        .filter((record) => {
          const key = String(record.date).slice(0, 10);
          return key >= weekStartKey && key <= weekEndKey;
        })
        .sort((a, b) => {
          const dateOrder = String(b.date).localeCompare(String(a.date));
          if (dateOrder !== 0) return dateOrder;
          return a.slot - b.slot;
        }),
    [records, weekEndKey, weekStartKey],
  );

  const selectedRecords = useMemo(() => {
    if (view === "daily") return todayRecords;
    if (view === "weekly") return weekRecords;
    return monthRecords;
  }, [monthRecords, todayRecords, view, weekRecords]);

  const counts = useMemo(
    () =>
      monthRecords.reduce(
        (acc, record) => {
          const key = record.status as AttendanceStatusName;
          if (key === "PRESENT") acc.present += 1;
          else if (key === "LATE") acc.late += 1;
          else if (key === "ABSENT") acc.absent += 1;
          else if (key === "EXCUSED") acc.excused += 1;
          return acc;
        },
        { present: 0, late: 0, absent: 0, excused: 0 },
      ),
    [monthRecords],
  );

  const selectedCounts = useMemo(
    () =>
      selectedRecords.reduce(
        (acc, record) => {
          const key = record.status as AttendanceStatusName;
          if (key === "PRESENT") acc.present += 1;
          else if (key === "LATE") acc.late += 1;
          else if (key === "ABSENT") acc.absent += 1;
          else if (key === "EXCUSED") acc.excused += 1;
          return acc;
        },
        { present: 0, late: 0, absent: 0, excused: 0 },
      ),
    [selectedRecords],
  );

  const viewMeta: Record<
    AttendanceView,
    { title: string; description: string; range: string; count: number }
  > = {
    daily: {
      title: "오늘 출석",
      description: "오늘 교시별 출석 상태를 확인합니다.",
      range: formatDate(now),
      count: todayRecords.length,
    },
    weekly: {
      title: "이번 주 출석",
      description: "월요일부터 일요일까지의 출석 흐름을 봅니다.",
      range: formatRange(weekStart, weekEnd),
      count: weekRecords.length,
    },
    monthly: {
      title: "이번 달 출석",
      description: "이번 달 전체 출석 기록과 관리자 수정 내역을 확인합니다.",
      range: currentMonth,
      count: monthRecords.length,
    },
  };

  return (
    <AppShell
      title="출석현황"
      subtitle="나의 교시별 출석 기록을 확인합니다"
      wide
      className="attendance-shell"
    >
      <section className="attendance-hero">
        <div>
          <CalendarMonthOutlinedIcon />
          <span>{currentMonth}</span>
          <h2>이번 달 출석 리포트</h2>
          <p>캠 입장 기록과 관리자 수정 내역이 함께 반영됩니다.</p>
        </div>
        <strong>{monthRecords.length}건</strong>
      </section>

      {error && <p className="attendance-error">{error}</p>}
      {loading && <p className="attendance-loading">출석 정보를 불러오는 중입니다.</p>}

      <section className="attendance-dashboard">
        <aside className="attendance-menu" aria-label="출석 보기 선택">
          {(Object.keys(viewMeta) as AttendanceView[]).map((key) => (
            <button
              className={view === key ? "is-active" : ""}
              key={key}
              onClick={() => setView(key)}
              type="button"
            >
              <span>{viewMeta[key].title}</span>
              <small>{viewMeta[key].range}</small>
              <strong>{viewMeta[key].count}건</strong>
            </button>
          ))}
        </aside>

        <div className="attendance-content">
          <section className="attendance-stats" aria-label="선택 기간 출석 요약">
            <div className="is-present">
              <CheckCircleOutlineOutlinedIcon />
              <span>출석</span>
              <strong>{selectedCounts.present}</strong>
            </div>
            <div className="is-late">
              <HourglassBottomOutlinedIcon />
              <span>지각</span>
              <strong>{selectedCounts.late}</strong>
            </div>
            <div className="is-excused">
              <EventAvailableOutlinedIcon />
              <span>인정</span>
              <strong>{selectedCounts.excused}</strong>
            </div>
            <div className="is-absent">
              <ErrorOutlineOutlinedIcon />
              <span>결석</span>
              <strong>{selectedCounts.absent}</strong>
            </div>
          </section>

          <section className="attendance-section is-selected-view">
            <div className="attendance-section-head">
              <div>
                <h3>{viewMeta[view].title}</h3>
                <p>{viewMeta[view].description}</p>
              </div>
              <span>{viewMeta[view].range}</span>
            </div>

            {selectedRecords.length === 0 ? (
              <p className="attendance-empty">
                선택한 기간에 기록된 출석이 없습니다. 작업장 입장 후 교시 출석이
                표시됩니다.
              </p>
            ) : view === "daily" ? (
              <div className="attendance-today-grid">
                {selectedRecords.map((record) => (
                  <article className="attendance-today-card" key={record.id}>
                    <span>{slotLabel(slots, record.slot)}</span>
                    <strong className={statusClass(record.status)}>
                      {statusText(record.status)}
                    </strong>
                  </article>
                ))}
              </div>
            ) : (
              <div className="attendance-list">
                {selectedRecords.slice(0, 60).map((record) => (
                  <article className="attendance-row" key={record.id}>
                    <div>
                      <strong>{formatDate(record.date)}</strong>
                      <span>{slotLabel(slots, record.slot)}</span>
                    </div>
                    <em className={statusClass(record.status)}>
                      {statusText(record.status)}
                    </em>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="attendance-note">
            <strong>기록 기준</strong>
            <p>
              공부방 입장과 관리자 수정 내역이 함께 반영됩니다. 쉬는시간은 출석
              집계에 포함되지 않습니다.
            </p>
            <small>
              이번 달 전체: 출석 {counts.present} · 지각 {counts.late} · 인정{" "}
              {counts.excused} · 결석 {counts.absent}
            </small>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
