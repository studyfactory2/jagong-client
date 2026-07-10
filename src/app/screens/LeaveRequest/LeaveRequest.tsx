import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import {
  cancelLeave,
  getLeaveCalendar,
  requestLeave,
} from "../../services/leave.service";
import { isMembershipAccessError } from "../../utils/access";
import type {
  LeaveRecord,
  LeaveTypeName,
  SpecialLeaveRecord,
} from "../../../lib/types";
import "./leave-request.css";

const TYPE_LABEL: Record<LeaveTypeName, string> = {
  FULL: "월차",
  MORNING: "오전반차",
  AFTERNOON: "오후반차",
};

const TYPE_VALUE: Array<{ key: LeaveTypeName; label: string }> = [
  { key: "FULL", label: "월차" },
  { key: "MORNING", label: "오전반차" },
  { key: "AFTERNOON", label: "오후반차" },
];

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function monthKey(date: Date) {
  return dateKey(date).slice(0, 7);
}

function monthDays(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function calendarCells(date: Date) {
  const firstWeekday = new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
  ).getDay();
  const leadingEmptyDays = (firstWeekday + 6) % 7;
  const days = Array.from({ length: monthDays(date) }, (_, i) => i + 1);
  const trailingEmptyDays = (7 - ((leadingEmptyDays + days.length) % 7)) % 7;

  return [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...days,
    ...Array.from({ length: trailingEmptyDays }, () => null),
  ];
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(date);
}

function formatDatePill(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = WEEKDAY_LABELS[date.getDay()];

  return `${year}.${month}.${day} (${weekday})`;
}

function isFutureDate(value: string) {
  return value > dateKey(new Date());
}

function tagFor(
  day: number,
  leaves: LeaveRecord[],
  special: SpecialLeaveRecord[],
) {
  const suffix = "-" + String(day).padStart(2, "0");
  const leave = leaves.find((item) => item.date.slice(0, 10).endsWith(suffix));
  if (leave) {
    const label =
      leave.leaveType === "MORNING"
        ? "오전"
        : leave.leaveType === "AFTERNOON"
          ? "오후"
          : (TYPE_LABEL[leave.leaveType] ?? leave.leaveType);

    return {
      className: "is-" + leave.leaveType.toLowerCase(),
      label,
    };
  }
  const item = special.find((entry) =>
    entry.date.slice(0, 10).endsWith(suffix),
  );
  if (!item) return null;
  if (item.type === "OUTING") return { className: "is-special", label: "외출" };
  if (item.type === "MOCK_EXAM") {
    return { className: "is-special", label: "모의" };
  }
  return { className: "is-special", label: "스터디" };
}

export default function LeaveRequest() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [leaveType, setLeaveType] = useState<LeaveTypeName>("FULL");
  const [reason, setReason] = useState("");
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [specialLeaves, setSpecialLeaves] = useState<SpecialLeaveRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const month = monthKey(currentMonth);
  const days = useMemo(() => calendarCells(currentMonth), [currentMonth]);
  const selectedDate = month + "-" + String(selectedDay).padStart(2, "0");
  const membershipLocked = isMembershipAccessError(error);
  const canRequestSelectedDate = isFutureDate(selectedDate);

  useEffect(() => {
    let alive = true;
    async function load() {
      setError("");
      try {
        const calendar = await getLeaveCalendar(month);
        if (!alive) return;
        setLeaves(calendar.leaves ?? []);
        setSpecialLeaves(calendar.specialLeaves ?? []);
      } catch (err) {
        if (!alive) return;
        setError(
          err instanceof Error
            ? err.message
            : "휴가 내역을 불러오지 못했습니다.",
        );
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [month]);

  function moveMonth(delta: number) {
    setCurrentMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + delta, 1),
    );
    setSelectedDay(1);
  }

  async function submit() {
    if (!canRequestSelectedDate) {
      setError("휴가는 내일 이후 날짜만 신청할 수 있습니다.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await requestLeave({
        date: selectedDate,
        leaveType,
        reason: reason.trim() || undefined,
      });
      setLeaves((current) => [created, ...current]);
      setReason("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "휴가 신청에 실패했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function cancel(id: string) {
    const target = leaves.find((item) => item.id === id);
    if (!target || !isFutureDate(String(target.date).slice(0, 10))) {
      setError(
        "오늘 또는 지난 휴가는 직접 취소할 수 없습니다. 관리자에게 문의해주세요.",
      );
      return;
    }

    setError("");
    try {
      const updated = await cancelLeave(id);
      setLeaves((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "휴가 취소에 실패했습니다.",
      );
    }
  }

  return (
    <div className="lv">
      <header className="lv-head">
        <button onClick={() => navigate("/waiting-room")} type="button">
          <ArrowBackIcon /> 대기장
        </button>
        <h1>휴가신청</h1>
        <span>{formatDatePill(selectedDate)}</span>
      </header>

      <main className="lv-body">
        {error && (
          <div className="lv-error">
            <span>{error}</span>
            {membershipLocked && (
              <button onClick={() => navigate("/payments")} type="button">
                이용권 결제하기
              </button>
            )}
          </div>
        )}

        <section className="lv-calendar">
          <div className="lv-cal-head">
            <button onClick={() => moveMonth(-1)} type="button">
              {"<"}
            </button>
            <strong>
              {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
            </strong>
            <button onClick={() => moveMonth(1)} type="button">
              {">"}
            </button>
          </div>
          <div className="lv-weekdays">
            {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="lv-days">
            {days.map((day, index) => {
              if (day === null) {
                return (
                  <span
                    aria-hidden="true"
                    className="lv-day-spacer"
                    key={"empty-" + index}
                  />
                );
              }
              const tag = tagFor(day, leaves, specialLeaves);
              return (
                <button
                  className={selectedDay === day ? "is-picked" : ""}
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  type="button"
                >
                  {day}
                  {tag && <em className={tag.className}>{tag.label}</em>}
                </button>
              );
            })}
          </div>
        </section>

        <section className="lv-apply">
          <strong>선택한 날짜 {formatDate(selectedDate)}</strong>
          <div>
            {TYPE_VALUE.map((type) => (
              <button
                className={[
                  "lv-type",
                  "is-" + type.key.toLowerCase(),
                  leaveType === type.key ? "is-active" : "",
                ].join(" ")}
                key={type.key}
                onClick={() => setLeaveType(type.key)}
                type="button"
              >
                {type.label}
              </button>
            ))}
            <button
              className="lv-submit"
              disabled={saving || membershipLocked || !canRequestSelectedDate}
              onClick={submit}
              type="button"
            >
              {saving ? "신청중" : "신청하기"}
            </button>
          </div>
        </section>

        <section className="lv-list">
          <div className="lv-list-head">
            <strong>신청내역 리스트</strong>
          </div>
          {leaves.length === 0 && (
            <p className="lv-empty">신청한 휴가가 없습니다.</p>
          )}
          {leaves.length > 0 && (
            <div className="lv-list-scroll">
              {leaves.map((leave) => (
                <div className="lv-list-row" key={leave.id}>
                  <CalendarMonthOutlinedIcon />
                  <span>{formatDate(leave.date)}</span>
                  <em
                    className={
                      "lv-leave-badge is-" + leave.leaveType.toLowerCase()
                    }
                  >
                    {TYPE_LABEL[leave.leaveType] ?? leave.leaveType}
                  </em>
                  <button
                    disabled={
                      leave.status === "CANCELLED" ||
                      !isFutureDate(String(leave.date).slice(0, 10))
                    }
                    onClick={() => cancel(leave.id)}
                    type="button"
                  >
                    {leave.status === "CANCELLED"
                      ? "취소됨"
                      : isFutureDate(String(leave.date).slice(0, 10))
                        ? "취소"
                        : "확정"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
