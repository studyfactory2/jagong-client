import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import EventRepeatOutlinedIcon from "@mui/icons-material/EventRepeatOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useSocket } from "../../context/SocketContext";
import {
  cancelLeave,
  getLeaveCalendar,
  requestLeave,
} from "../../services/leave.service";
import { getTimetable } from "../../services/timetable.service";
import { isMembershipAccessError } from "../../utils/access";
import type {
  LeaveRecord,
  LeaveTypeName,
  MemberLeaveCalendarItem,
  TimetableSlot,
} from "../../../lib/types";
import "./leave-request.css";

const TYPE_LABEL: Record<LeaveTypeName, string> = {
  FULL: "월차",
  MORNING: "오전반차",
  AFTERNOON: "오후반차",
};

const TYPE_SHORT_LABEL: Record<LeaveTypeName, string> = {
  FULL: "월차",
  MORNING: "오전",
  AFTERNOON: "오후",
};

const TYPE_VALUE: Array<{ key: LeaveTypeName; label: string }> = [
  { key: "FULL", label: "월차" },
  { key: "MORNING", label: "오전반차" },
  { key: "AFTERNOON", label: "오후반차" },
];

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAY_FULL_LABELS = [
  "일요일",
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일",
];

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function apiDateKey(value: string) {
  return value.slice(0, 10);
}

function monthKey(date: Date) {
  return dateKey(date).slice(0, 7);
}

function monthDays(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function calendarCells(date: Date) {
  const firstWeekday = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const leadingEmptyDays = (firstWeekday + 6) % 7;
  const days = Array.from({ length: monthDays(date) }, (_, index) => index + 1);
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
  return `${year}.${month}.${day} (${WEEKDAY_LABELS[date.getDay()]})`;
}

function isFutureDate(value: string) {
  return value > dateKey(new Date());
}

function formatSlots(slots: number[], timetable: TimetableSlot[]) {
  const uniqueSlots = [...new Set(slots)].sort((a, b) => a - b);
  if (uniqueSlots.length === 0) return "하루 전체";

  const workSlots = timetable.filter(
    (slot) => !slot.isBreak && slot.slot !== 0 && !slot.label.includes("출근"),
  );
  const selectedPeriods = workSlots.filter((slot) => uniqueSlots.includes(slot.slot));
  if (selectedPeriods.length === 0) return "선택 교시";

  const periodNumbers = selectedPeriods
    .map((slot) => slot.label.match(/(\d+)\s*교시/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number);
  const isConsecutive = periodNumbers.every(
    (period, index) => index === 0 || period === periodNumbers[index - 1] + 1,
  );

  if (periodNumbers.length === selectedPeriods.length && isConsecutive) {
    return periodNumbers.length === 1
      ? `${periodNumbers[0]}교시`
      : `${periodNumbers[0]}-${periodNumbers[periodNumbers.length - 1]}교시`;
  }

  return selectedPeriods.map((slot) => slot.label).join(" · ");
}

function itemLabel(item: MemberLeaveCalendarItem) {
  if (item.source === "FIXED") return item.reason?.trim() || "정기 휴무";
  if (item.source === "LEAVE") {
    return TYPE_SHORT_LABEL[item.type as LeaveTypeName] ?? "휴가";
  }
  if (item.type === "OUTING") return "외출";
  if (item.type === "MOCK_EXAM") return "모의";
  return item.reason?.trim() || "일정";
}

function itemDescription(item: MemberLeaveCalendarItem, timetable: TimetableSlot[]) {
  if (item.source === "FIXED") return `정기 휴무 · ${formatSlots(item.slots, timetable)}`;
  if (item.source === "LEAVE") {
    const leaveType = TYPE_LABEL[item.type as LeaveTypeName] ?? "휴가";
    return item.reason?.trim() || `직접 신청한 ${leaveType}`;
  }
  return item.reason?.trim() || formatSlots(item.slots, timetable);
}

function itemClassName(item: MemberLeaveCalendarItem) {
  if (item.source === "FIXED") return "is-fixed";
  if (item.source === "LEAVE") return `is-${String(item.type).toLowerCase()}`;
  return "is-special";
}

function calendarTag(items: MemberLeaveCalendarItem[], timetable: TimetableSlot[]) {
  const item =
    items.find((entry) => entry.source === "LEAVE") ??
    items.find((entry) => entry.source === "FIXED") ??
    items[0];
  if (!item) return null;

  return {
    className: itemClassName(item),
    label: itemLabel(item),
    title: itemDescription(item, timetable),
  };
}

export default function LeaveRequest() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [leaveType, setLeaveType] = useState<LeaveTypeName>("FULL");
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [calendarItems, setCalendarItems] = useState<MemberLeaveCalendarItem[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const month = monthKey(currentMonth);
  const days = useMemo(() => calendarCells(currentMonth), [currentMonth]);
  const selectedDate = `${month}-${String(selectedDay).padStart(2, "0")}`;
  const membershipLocked = isMembershipAccessError(error);

  const refreshCalendar = useCallback(async () => {
    setError("");
    try {
      const calendar = await getLeaveCalendar(month);
      setLeaves(calendar.leaves ?? []);
      setCalendarItems(calendar.items ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "휴가 내역을 불러오지 못했습니다.",
      );
    }
  }, [month]);

  useEffect(() => {
    let alive = true;
    async function loadInitialCalendar() {
      try {
        const calendar = await getLeaveCalendar(month);
        if (!alive) return;
        setLeaves(calendar.leaves ?? []);
        setCalendarItems(calendar.items ?? []);
      } catch (err) {
        if (!alive) return;
        setError(
          err instanceof Error ? err.message : "휴가 내역을 불러오지 못했습니다.",
        );
      }
    }
    void loadInitialCalendar();
    return () => {
      alive = false;
    };
  }, [month]);

  useEffect(() => {
    let alive = true;
    async function loadTimetable() {
      try {
        const slots = await getTimetable();
        if (alive) setTimetable(slots);
      } catch {
        // Keep the leave page usable if timetable labels are temporarily unavailable.
      }
    }
    void loadTimetable();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onLeaveUpdated = () => void refreshCalendar();
    socket.on("leave:updated", onLeaveUpdated);
    return () => {
      socket.off("leave:updated", onLeaveUpdated);
    };
  }, [refreshCalendar, socket]);

  const itemsByDate = useMemo(() => {
    const entries = new Map<string, MemberLeaveCalendarItem[]>();
    calendarItems.forEach((item) => {
      const key = apiDateKey(item.date);
      entries.set(key, [...(entries.get(key) ?? []), item]);
    });
    return entries;
  }, [calendarItems]);

  const selectedItems = itemsByDate.get(selectedDate) ?? [];
  const selectedRequest = selectedItems.find((item) => item.source === "LEAVE");
  const canRequestSelectedDate =
    isFutureDate(selectedDate) && selectedItems.length === 0;

  const regularLeaveRules = useMemo(() => {
    const rules = new Map<
      string,
      { id: string; weekday: string; reason: string; slots: number[] }
    >();
    calendarItems
      .filter((item) => item.source === "FIXED")
      .forEach((item) => {
        if (rules.has(item.id)) return;
        const weekday = new Date(`${apiDateKey(item.date)}T00:00:00`).getDay();
        rules.set(item.id, {
          id: item.id,
          weekday: WEEKDAY_FULL_LABELS[weekday],
          reason: item.reason?.trim() || "정기 휴무",
          slots: item.slots,
        });
      });
    return [...rules.values()];
  }, [calendarItems]);

  function moveMonth(delta: number) {
    setCurrentMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + delta, 1),
    );
    setSelectedDay(1);
  }

  async function submit() {
    if (!canRequestSelectedDate) {
      setError("이미 적용된 휴가 또는 일정이 있는 날짜입니다.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await requestLeave({ date: selectedDate, leaveType });
      await refreshCalendar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "휴가 신청에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function cancel(id: string) {
    const target = leaves.find((item) => item.id === id);
    if (!target || !isFutureDate(apiDateKey(String(target.date)))) {
      setError("오늘 또는 지난 휴가는 직접 취소할 수 없습니다. 관리자에게 문의해주세요.");
      return;
    }

    setError("");
    try {
      await cancelLeave(id);
      await refreshCalendar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "휴가 취소에 실패했습니다.");
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

        <section className="lv-calendar" aria-label="내 휴가 달력">
          <div className="lv-section-title">
            <CalendarMonthOutlinedIcon />
            <div><span>내 휴가 달력</span><p>정기 휴무와 신청한 휴가를 확인하세요.</p></div>
          </div>
          <div className="lv-cal-head">
            <button aria-label="이전 달" onClick={() => moveMonth(-1)} type="button">‹</button>
            <strong>{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</strong>
            <button aria-label="다음 달" onClick={() => moveMonth(1)} type="button">›</button>
          </div>
          <div className="lv-weekdays">
            {["월", "화", "수", "목", "금", "토", "일"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="lv-days">
            {days.map((day, index) => {
              if (day === null) return <span aria-hidden="true" className="lv-day-spacer" key={`empty-${index}`} />;
              const key = `${month}-${String(day).padStart(2, "0")}`;
              const dayItems = itemsByDate.get(key) ?? [];
              const tag = calendarTag(dayItems, timetable);
              return (
                <button
                  aria-pressed={selectedDay === day}
                  className={selectedDay === day ? "is-picked" : ""}
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  title={tag?.title}
                  type="button"
                >
                  <span>{day}</span>
                  {tag && <em className={tag.className}>{tag.label}</em>}
                  {dayItems.length > 1 && <i>+{dayItems.length - 1}</i>}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="lv-side-stack">
          <section className="lv-apply" aria-label="휴가 신청">
            <div className="lv-section-title">
              <EventAvailableOutlinedIcon />
              <div><span>휴가 신청</span><p>선택한 날짜 {formatDate(selectedDate)}</p></div>
            </div>

            {selectedItems.length > 0 ? (
              <div className="lv-applied-list">
                {selectedItems.map((item) => {
                  const canCancel = item.source === "LEAVE" && isFutureDate(selectedDate);
                  return (
                    <div className="lv-applied-item" key={`${item.source}-${item.id}`}>
                      <span className={itemClassName(item)}>{itemLabel(item)}</span>
                      <div><strong>{item.source === "FIXED" ? "정기 휴무 적용됨" : "휴가 적용됨"}</strong><p>{itemDescription(item, timetable)}</p></div>
                      {canCancel ? <button onClick={() => void cancel(item.id)} type="button">취소</button> : <em>{item.source === "FIXED" ? "관리자 설정" : "적용됨"}</em>}
                    </div>
                  );
                })}
                {!selectedRequest && <small><InfoOutlinedIcon /> 정기 휴무는 관리자만 변경할 수 있습니다.</small>}
              </div>
            ) : (
              <div className="lv-request-controls">
                <div className="lv-type-choice" role="group" aria-label="휴가 유형">
                  {TYPE_VALUE.map((type) => (
                    <button
                      className={[
                        "lv-type",
                        `is-${type.key.toLowerCase()}`,
                        leaveType === type.key ? "is-active" : "",
                      ].join(" ")}
                      key={type.key}
                      onClick={() => setLeaveType(type.key)}
                      type="button"
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
                <button className="lv-submit" disabled={saving || membershipLocked || !canRequestSelectedDate} onClick={() => void submit()} type="button">
                  {saving ? "신청 중" : "휴가 신청"}
                </button>
                {!isFutureDate(selectedDate) && <small>휴가는 내일 이후 날짜부터 신청할 수 있습니다.</small>}
              </div>
            )}
          </section>

          <section className="lv-regular" aria-label="정기 휴무">
            <div className="lv-section-title">
              <EventRepeatOutlinedIcon />
              <div><span>정기 휴무</span><p>관리자가 설정한 반복 일정입니다.</p></div>
            </div>
            {regularLeaveRules.length > 0 ? (
              <div className="lv-regular-scroll">
                {regularLeaveRules.map((rule) => (
                  <article key={rule.id}>
                    <span>{rule.weekday}</span>
                    <strong>{rule.reason}</strong>
                    <em>{formatSlots(rule.slots, timetable)}</em>
                  </article>
                ))}
              </div>
            ) : <p className="lv-regular-empty">등록된 정기 휴무가 없습니다.</p>}
          </section>

          <section className="lv-list" aria-label="이번 달 휴가 신청 내역">
            <div className="lv-list-head">
              <div><span>이번 달</span><strong>신청 내역</strong></div>
              <em>{leaves.length}건</em>
            </div>
            {leaves.length === 0 ? <p className="lv-empty">이번 달 신청한 휴가가 없습니다.</p> : (
              <div className="lv-list-scroll">
                {leaves.map((leave) => {
                  const canCancel = leave.status !== "CANCELLED" && isFutureDate(apiDateKey(String(leave.date)));
                  return (
                    <div className="lv-list-row" key={leave.id}>
                      <CalendarMonthOutlinedIcon />
                      <div><strong>{formatDate(leave.date)}</strong><span>{leave.reason?.trim() || "직접 신청한 휴가"}</span></div>
                      <em className={`lv-leave-badge is-${leave.leaveType.toLowerCase()}`}>{TYPE_LABEL[leave.leaveType] ?? leave.leaveType}</em>
                      {canCancel ? <button onClick={() => void cancel(leave.id)} type="button">취소</button> : <small>{leave.status === "CANCELLED" ? "취소됨" : "적용됨"}</small>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </aside>
      </main>

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
