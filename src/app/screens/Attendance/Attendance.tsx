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

function formatDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(date);
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const currentMonth = monthKey(new Date());

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

      <section className="attendance-stats" aria-label="출석 요약">
        <div className="is-present">
          <CheckCircleOutlineOutlinedIcon />
          <span>출석</span>
          <strong>{counts.present}</strong>
        </div>
        <div className="is-late">
          <HourglassBottomOutlinedIcon />
          <span>지각</span>
          <strong>{counts.late}</strong>
        </div>
        <div className="is-excused">
          <EventAvailableOutlinedIcon />
          <span>인정</span>
          <strong>{counts.excused}</strong>
        </div>
        <div className="is-absent">
          <ErrorOutlineOutlinedIcon />
          <span>결석</span>
          <strong>{counts.absent}</strong>
        </div>
      </section>

      <section className="attendance-section">
        <div className="attendance-section-head">
          <h3>오늘 출석</h3>
          <span>{formatDate(new Date())}</span>
        </div>

        {todayRecords.length === 0 ? (
          <p className="attendance-empty">
            오늘 기록된 출석이 없습니다. 작업장 입장 후 교시 출석이 표시됩니다.
          </p>
        ) : (
          <div className="attendance-today-grid">
            {todayRecords.map((record) => (
              <article className="attendance-today-card" key={record.id}>
                <span>{slotLabel(slots, record.slot)}</span>
                <strong className={statusClass(record.status)}>
                  {statusText(record.status)}
                </strong>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="attendance-section">
        <div className="attendance-section-head">
          <h3>최근 기록</h3>
          <span>최신순</span>
        </div>

        {monthRecords.length === 0 ? (
          <p className="attendance-empty">이번 달 출석 기록이 없습니다.</p>
        ) : (
          <div className="attendance-list">
            {monthRecords.slice(0, 40).map((record) => (
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
    </AppShell>
  );
}
