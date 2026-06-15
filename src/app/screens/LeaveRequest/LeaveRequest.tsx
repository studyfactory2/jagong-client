import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import {
  cancelLeave,
  getLeaveCalendar,
  requestLeave,
} from "../../services/leave.service";
import type { LeaveRecord, LeaveTypeName, SpecialLeaveRecord } from "../../../lib/types";
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

function tagFor(day: number, leaves: LeaveRecord[], special: SpecialLeaveRecord[]) {
  const suffix = "-" + String(day).padStart(2, "0");
  const leave = leaves.find((item) => item.date.slice(0, 10).endsWith(suffix));
  if (leave) return TYPE_LABEL[leave.leaveType] ?? leave.leaveType;
  const item = special.find((entry) => entry.date.slice(0, 10).endsWith(suffix));
  if (!item) return "";
  if (item.type === "OUTING") return "외출";
  if (item.type === "MOCK_EXAM") return "모의";
  return "스터디";
}

export default function LeaveRequest() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [leaveType, setLeaveType] = useState<LeaveTypeName>("FULL");
  const [reason, setReason] = useState("");
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [specialLeaves, setSpecialLeaves] = useState<SpecialLeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const month = monthKey(currentMonth);
  const days = useMemo(() => Array.from({ length: monthDays(currentMonth) }, (_, i) => i + 1), [currentMonth]);
  const selectedDate = month + "-" + String(selectedDay).padStart(2, "0");
  const membershipLocked = error.includes("이용권 결제");

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const calendar = await getLeaveCalendar(month);
        if (!alive) return;
        setLeaves(calendar.leaves ?? []);
        setSpecialLeaves(calendar.specialLeaves ?? []);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "휴가 내역을 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [month]);

  function moveMonth(delta: number) {
    setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setSelectedDay(1);
  }

  async function submit() {
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
      setError(err instanceof Error ? err.message : "휴가 신청에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function cancel(id: string) {
    setError("");
    try {
      const updated = await cancelLeave(id);
      setLeaves((current) => current.map((item) => (item.id === id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "휴가 취소에 실패했습니다.");
    }
  }

  return (
    <div className="lv">
      <header className="lv-head">
        <button onClick={() => navigate("/waiting-room")} type="button">
          <ArrowBackIcon /> 대기실
        </button>
        <h1>휴가신청</h1>
        <span>{month.replace("-", ".")}</span>
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

        <section className="lv-guide">
          <span>휴가</span>
          <div>
            <strong>쉬는 날도 계획적으로 관리해요</strong>
            <p>{loading ? "휴가 내역을 불러오는 중입니다." : "월차·반차 신청과 지난 휴가 내역을 한눈에 볼 수 있어요."}</p>
          </div>
        </section>

        <section className="lv-calendar">
          <div className="lv-cal-head">
            <button onClick={() => moveMonth(-1)} type="button">{"<"}</button>
            <strong>{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</strong>
            <button onClick={() => moveMonth(1)} type="button">{">"}</button>
          </div>
          <div className="lv-weekdays">
            {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="lv-days">
            {days.map((day) => {
              const tag = tagFor(day, leaves, specialLeaves);
              return (
                <button
                  className={selectedDay === day ? "is-picked" : ""}
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  type="button"
                >
                  {day}
                  {tag && <em>{tag}</em>}
                </button>
              );
            })}
          </div>
        </section>

        <div className="lv-info is-yellow">
          매주 월차와 반차 신청 한도가 적용됩니다. 승인/반려 상태는 관리자 확인 후 반영돼요.
        </div>
        <div className="lv-info is-green">
          관리자 등록 일정 · 외출 · 모의 · 스터디 일정도 달력에 함께 표시됩니다.
        </div>

        <section className="lv-apply">
          <strong>선택한 날짜 {formatDate(selectedDate)}</strong>
          <div>
            {TYPE_VALUE.map((type) => (
              <button
                className={leaveType === type.key ? "is-active" : ""}
                key={type.key}
                onClick={() => setLeaveType(type.key)}
                type="button"
              >
                {type.label}
              </button>
            ))}
            <button className="lv-submit" disabled={saving || membershipLocked} onClick={submit} type="button">
              {saving ? "신청중" : "신청하기"}
            </button>
          </div>
          <input
            className="lv-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="사유를 입력해주세요 (선택)"
          />
        </section>

        <section className="lv-list">
          <div className="lv-list-head">
            <strong>신청내역 리스트</strong>
            <span>미래 휴가만 취소 가능</span>
          </div>
          {leaves.length === 0 && <p className="lv-empty">신청한 휴가가 없습니다.</p>}
          {leaves.map((leave) => (
            <div className="lv-list-row" key={leave.id}>
              <CalendarMonthOutlinedIcon />
              <span>{formatDate(leave.date)}</span>
              <em className={leave.leaveType === "FULL" ? "is-green" : "is-coral"}>
                {TYPE_LABEL[leave.leaveType] ?? leave.leaveType}
              </em>
              <button
                disabled={leave.status === "CANCELLED"}
                onClick={() => cancel(leave.id)}
                type="button"
              >
                {leave.status === "CANCELLED" ? "취소됨" : "취소"}
              </button>
            </div>
          ))}
        </section>

        <div className="lv-info is-yellow">
          오늘보다 과거에 신청한 휴가 내역은 취소할 수 없어요. 변경이 필요하면 관리자에게 문의해주세요.
        </div>
      </main>

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
