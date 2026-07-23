import { useCallback, useEffect, useMemo, useState } from "react";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import ChevronLeftOutlinedIcon from "@mui/icons-material/ChevronLeftOutlined";
import ChevronRightOutlinedIcon from "@mui/icons-material/ChevronRightOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import EventRepeatOutlinedIcon from "@mui/icons-material/EventRepeatOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import { useSocket } from "../../context/SocketContext";
import {
  getAdminAttendance,
  markAttendance,
} from "../../services/attendance.service";
import {
  cancelFixedLeave,
  cancelFixedLeaveOccurrence,
  cancelLeaveFromAttendance,
  createFixedLeave,
  getFixedLeaves,
  getLeaveAttendanceCoverage,
  getMemberLeaveCalendar,
} from "../../services/leave.service";
import type {
  AdminUser,
  AttendanceRecord,
  AttendanceStatusName,
  DayOfWeekName,
  FixedLeaveRecord,
  LeaveCoverageItem,
  MemberLeaveCalendarItem,
  TimetableSlot,
} from "../../../lib/types";

type AttendanceProps = {
  users: AdminUser[];
  timetable: TimetableSlot[];
  initialMemberId?: string;
  onViewPayments?: (userId: string, userName: string) => void;
};

type WorkspaceView = "attendance" | "member-list" | "member-detail";
type MemberPanel = "calendar" | "fixed";

type ReasonDialogState = {
  userId: string;
  userName: string;
  date: string;
  slots: number[];
  anchorSlot: number;
  reasonType: string;
  reason: string;
};

type FixedLeaveForm = {
  dayOfWeek: DayOfWeekName;
  startDate: string;
  endDate: string;
  slots: number[];
  reason: string;
};

type LeaveCancelDialogState = {
  coverage: LeaveCoverageItem;
  slotLabel: string;
  scope: "occurrence" | "rule";
};

const STATUS_OPTIONS: Array<{ value: AttendanceStatusName; label: string }> = [
  { value: "PRESENT", label: "출석" },
  { value: "LATE", label: "지각" },
  { value: "ABSENT", label: "결석" },
  { value: "EXCUSED", label: "기타" },
];

const STATUS_CELL_LABEL: Record<AttendanceStatusName, string> = {
  PRESENT: "O",
  LATE: "지",
  ABSENT: "X",
  EXCUSED: "기",
};

const STATUS_TABLE_LABEL: Record<AttendanceStatusName, string> = {
  PRESENT: "O",
  LATE: "지각",
  ABSENT: "X",
  EXCUSED: "기타",
};

const STATUS_TITLE: Record<AttendanceStatusName, string> = {
  PRESENT: "출석",
  LATE: "지각",
  ABSENT: "결석",
  EXCUSED: "기타",
};

const REASON_TYPES = ["지각", "조퇴", "외출", "이동", "시험", "컨디션"];

const WEEKDAYS: Array<{ key: DayOfWeekName; label: string; short: string }> = [
  { key: "SUN", label: "일요일", short: "일" },
  { key: "MON", label: "월요일", short: "월" },
  { key: "TUE", label: "화요일", short: "화" },
  { key: "WED", label: "수요일", short: "수" },
  { key: "THU", label: "목요일", short: "목" },
  { key: "FRI", label: "금요일", short: "금" },
  { key: "SAT", label: "토요일", short: "토" },
];

const LEAVE_TYPE_LABEL = {
  FULL: "월차",
  MORNING: "오전",
  AFTERNOON: "오후",
} as const;

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shiftDate(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function monthBounds(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${year}-${String(month).padStart(2, "0")}-01`,
    endDate: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

function dayOfWeekFor(dateKey: string): DayOfWeekName {
  return WEEKDAYS[new Date(`${dateKey}T00:00:00Z`).getUTCDay()].key;
}

function dateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")} (${weekday.short})`;
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${year}년 ${monthNumber}월`;
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function calendarDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const startsOn = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const totalDays = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const totalCells = Math.ceil((startsOn + totalDays) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const day = index - startsOn + 1;
    return day > 0 && day <= totalDays ? day : null;
  });
}

function recordKey(userId: string, slot: number) {
  return `${userId}:${slot}`;
}

function statusClass(status?: string) {
  return status ? `is-${status.toLowerCase()}` : "is-empty";
}

function isClockInSlot(slot: TimetableSlot) {
  return slot.slot === 0 || slot.label.includes("출근");
}

function isAttendanceSlot(slot: TimetableSlot) {
  return !slot.isBreak && !isClockInSlot(slot);
}

function compactSlotLabel(slot: TimetableSlot) {
  return slot.label.match(/(\d+)\s*교시/)?.[1] ?? slot.label.replace("교시", "");
}

function coverageLabel(coverage: LeaveCoverageItem) {
  if (coverage.source === "FIXED_LEAVE") return "고정";
  if (coverage.leaveType) return LEAVE_TYPE_LABEL[coverage.leaveType];
  return "휴가";
}

function coverageReason(coverage: LeaveCoverageItem) {
  return coverage.reason?.trim() || coverageLabel(coverage);
}

function coverageAppliesToSlot(
  coverage: LeaveCoverageItem,
  slot: number,
  workSlots: TimetableSlot[],
) {
  if (coverage.source === "FIXED_LEAVE") return coverage.slots.includes(slot);
  if (coverage.leaveType === "FULL" || !coverage.leaveType) return true;

  const slotIndex = workSlots.findIndex((item) => item.slot === slot);
  const morningLength = Math.floor(workSlots.length / 2);
  return coverage.leaveType === "MORNING"
    ? slotIndex >= 0 && slotIndex < morningLength
    : slotIndex >= morningLength;
}

function calendarFallbackLabel(item: MemberLeaveCalendarItem) {
  if (item.source === "FIXED") return "고정";
  if (item.source === "SPECIAL") return "일정";
  if (item.type === "FULL") return "월차";
  if (item.type === "MORNING") return "오전";
  if (item.type === "AFTERNOON") return "오후";
  return "휴가";
}

function calendarReasonLabel(item: MemberLeaveCalendarItem) {
  return item.reason?.trim() || calendarFallbackLabel(item);
}

export default function Attendance({
  users,
  timetable,
  initialMemberId = "",
  onViewPayments,
}: AttendanceProps) {
  const { socket } = useSocket();
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [coverage, setCoverage] = useState<LeaveCoverageItem[]>([]);
  const [search, setSearch] = useState("");
  const [paintStatus, setPaintStatus] = useState<AttendanceStatusName>("PRESENT");
  const [selected, setSelected] = useState<{ userId: string; slot: number } | null>(null);
  const [savingKey, setSavingKey] = useState("");
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(
    initialMemberId ? "member-detail" : "attendance",
  );
  const [memberPanel, setMemberPanel] = useState<MemberPanel>("calendar");
  const [activeMemberId, setActiveMemberId] = useState(initialMemberId);
  const [memberCalendarMonth, setMemberCalendarMonth] = useState(todayKey().slice(0, 7));
  const [memberCalendarItems, setMemberCalendarItems] = useState<MemberLeaveCalendarItem[]>([]);
  const [fixedRules, setFixedRules] = useState<FixedLeaveRecord[]>([]);
  const [memberCalendarLoading, setMemberCalendarLoading] = useState(false);
  const [fixedRulesLoading, setFixedRulesLoading] = useState(false);
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState | null>(null);
  const [fixedForm, setFixedForm] = useState<FixedLeaveForm | null>(null);
  const [leaveCancelDialog, setLeaveCancelDialog] = useState<LeaveCancelDialogState | null>(null);
  const [reasonSaving, setReasonSaving] = useState(false);
  const [fixedSaving, setFixedSaving] = useState(false);
  const [leaveCancelling, setLeaveCancelling] = useState(false);
  const [error, setError] = useState("");

  const workSlots = useMemo(
    () => timetable.filter(isAttendanceSlot).sort((a, b) => a.slot - b.slot),
    [timetable],
  );

  const members = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return users.filter((user) => {
      if (user.role !== "MEMBER") return false;
      if (!keyword) return true;
      return user.name.toLowerCase().includes(keyword);
    });
  }, [search, users]);

  const activeMember = users.find((user) => user.id === activeMemberId) ?? null;

  const recordMap = useMemo(
    () => new Map(records.map((record) => [recordKey(record.userId, record.slot), record])),
    [records],
  );

  const coverageByUser = useMemo(
    () => new Map(coverage.map((item) => [item.user.id, item])),
    [coverage],
  );

  const excusedCount = useMemo(
    () => records.filter((record) => record.status === "EXCUSED").length,
    [records],
  );

  const loadAttendance = useCallback(async () => {
    setError("");
    try {
      const [attendanceData, coverageData] = await Promise.all([
        getAdminAttendance({ date: selectedDate }),
        getLeaveAttendanceCoverage({ date: selectedDate }),
      ]);
      setRecords(attendanceData);
      setCoverage(coverageData.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "출석 정보를 불러오지 못했습니다.");
    }
  }, [selectedDate]);

  const loadFixedRules = useCallback(async (userId: string) => {
    if (!userId) {
      setFixedRules([]);
      return;
    }

    setFixedRulesLoading(true);
    try {
      const result = await getFixedLeaves({ userId, limit: 50 });
      setFixedRules(result.list ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "고정 휴무를 불러오지 못했습니다.");
    } finally {
      setFixedRulesLoading(false);
    }
  }, []);

  const loadMemberCalendar = useCallback(async (userId: string, month: string) => {
    if (!userId) {
      setMemberCalendarItems([]);
      return;
    }

    setMemberCalendarLoading(true);
    try {
      const calendar = await getMemberLeaveCalendar({ userId, month });
      setMemberCalendarItems(calendar.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "회원 휴가 현황을 불러오지 못했습니다.");
    } finally {
      setMemberCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAttendance(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAttendance]);

  useEffect(() => {
    if (!socket) return;
    const refreshLeaveCoverage = () => void loadAttendance();
    socket.on("leave:updated", refreshLeaveCoverage);
    return () => {
      socket.off("leave:updated", refreshLeaveCoverage);
    };
  }, [loadAttendance, socket]);

  useEffect(() => {
    if (workspaceView !== "member-detail" || !activeMemberId) return;
    const timer = window.setTimeout(() => {
      void loadFixedRules(activeMemberId);
      void loadMemberCalendar(activeMemberId, memberCalendarMonth);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeMemberId, loadFixedRules, loadMemberCalendar, memberCalendarMonth, workspaceView]);

  function updateRecords(updatedRecords: AttendanceRecord[]) {
    setRecords((current) => {
      const next = [...current];
      updatedRecords.forEach((updated) => {
        const index = next.findIndex((record) => record.id === updated.id);
        if (index >= 0) next[index] = updated;
        else next.unshift(updated);
      });
      return next;
    });
  }

  function openMemberDetail(userId: string, panel: MemberPanel = "calendar") {
    setActiveMemberId(userId);
    setMemberPanel(panel);
    setMemberCalendarMonth(selectedDate.slice(0, 7));
    setWorkspaceView("member-detail");
  }

  function openReasonDialog(userId: string, slot: number) {
    const user = users.find((item) => item.id === userId);
    const existing = recordMap.get(recordKey(userId, slot));
    setReasonDialog({
      userId,
      userName: user?.name ?? "회원",
      date: selectedDate,
      slots: [slot],
      anchorSlot: slot,
      reasonType: existing?.reasonType || "컨디션",
      reason: existing?.reason || "",
    });
  }

  async function paintCell(userId: string, slot: number) {
    const userCoverage = coverageByUser.get(userId);
    if (userCoverage && coverageAppliesToSlot(userCoverage, slot, workSlots)) {
      const slotLabel = workSlots.find((item) => item.slot === slot)?.label ?? "선택 교시";
      setLeaveCancelDialog({ coverage: userCoverage, slotLabel, scope: "occurrence" });
      return;
    }

    setSelected({ userId, slot });
    if (paintStatus === "EXCUSED") {
      openReasonDialog(userId, slot);
      return;
    }

    const key = recordKey(userId, slot);
    setSavingKey(key);
    setError("");
    try {
      const updated = await markAttendance({ userId, date: selectedDate, slot, status: paintStatus });
      updateRecords([updated]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "출석 상태를 저장하지 못했습니다.");
    } finally {
      setSavingKey("");
    }
  }

  function toggleReasonSlot(slot: number) {
    setReasonDialog((current) => {
      if (!current) return current;
      const slots = current.slots.includes(slot)
        ? current.slots.filter((item) => item !== slot)
        : [...current.slots, slot].sort((a, b) => a - b);
      return { ...current, slots: slots.length ? slots : [slot] };
    });
  }

  async function saveReason() {
    if (!reasonDialog || !reasonDialog.slots.length) return;
    const reasonType = reasonDialog.reasonType.trim();
    const reason = reasonDialog.reason.trim();
    if (!reasonType && !reason) {
      setError("기타 사유를 선택하거나 입력해 주세요.");
      return;
    }

    setReasonSaving(true);
    try {
      const updated = await Promise.all(
        reasonDialog.slots.map((slot) =>
          markAttendance({
            userId: reasonDialog.userId,
            date: reasonDialog.date,
            slot,
            status: "EXCUSED",
            reasonType,
            reason,
          }),
        ),
      );
      if (reasonDialog.date === selectedDate) updateRecords(updated);
      else setSelectedDate(reasonDialog.date);
      setSelected({ userId: reasonDialog.userId, slot: reasonDialog.anchorSlot });
      setReasonDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "기타 사유를 저장하지 못했습니다.");
    } finally {
      setReasonSaving(false);
    }
  }

  function openFixedForm() {
    const { startDate, endDate } = monthBounds(selectedDate);
    setFixedForm({
      dayOfWeek: dayOfWeekFor(selectedDate),
      startDate,
      endDate,
      slots: workSlots.map((slot) => slot.slot),
      reason: "정기 휴무",
    });
  }

  function toggleFixedSlot(slot: number) {
    setFixedForm((current) => {
      if (!current) return current;
      const slots = current.slots.includes(slot)
        ? current.slots.filter((item) => item !== slot)
        : [...current.slots, slot].sort((a, b) => a - b);
      return { ...current, slots: slots.length ? slots : [slot] };
    });
  }

  async function saveFixedLeave() {
    if (!fixedForm || !activeMember) return;
    const reason = fixedForm.reason.trim();
    if (!fixedForm.slots.length || !reason) {
      setError("적용 교시와 사유를 확인해 주세요.");
      return;
    }

    setFixedSaving(true);
    try {
      await createFixedLeave({
        userId: activeMember.id,
        dayOfWeek: fixedForm.dayOfWeek,
        startDate: fixedForm.startDate,
        endDate: fixedForm.endDate,
        slots: fixedForm.slots,
        reason,
      });
      setFixedForm(null);
      await Promise.all([
        loadFixedRules(activeMember.id),
        loadMemberCalendar(activeMember.id, memberCalendarMonth),
        loadAttendance(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "고정 휴무를 등록하지 못했습니다.");
    } finally {
      setFixedSaving(false);
    }
  }

  async function cancelLeaveCoverage() {
    if (!leaveCancelDialog) return;
    const { coverage: target, scope } = leaveCancelDialog;
    setLeaveCancelling(true);
    try {
      if (target.source === "LEAVE_REQUEST") await cancelLeaveFromAttendance(target.sourceId);
      else if (scope === "rule") await cancelFixedLeave(target.sourceId);
      else await cancelFixedLeaveOccurrence(target.sourceId, selectedDate);

      setLeaveCancelDialog(null);
      await loadAttendance();
      if (activeMemberId === target.user.id) {
        await Promise.all([
          loadFixedRules(target.user.id),
          loadMemberCalendar(target.user.id, memberCalendarMonth),
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "휴가를 취소하지 못했습니다.");
    } finally {
      setLeaveCancelling(false);
    }
  }

  function renderMemberDirectory() {
    return (
      <section className="attendance-directory">
        <label className="attendance-search-field">
          <SearchOutlinedIcon />
          <input onChange={(event) => setSearch(event.target.value)} placeholder="이름 검색" value={search} />
        </label>
        <div className="attendance-member-list">
          {members.map((member) => (
            <button key={member.id} onClick={() => openMemberDetail(member.id)} type="button">
              <span aria-hidden="true" className="attendance-member-avatar">
                {member.name.trim().charAt(0) || "회"}
              </span>
              <span className="attendance-member-copy">
                <strong>{member.name}</strong>
              </span>
              <ChevronRightOutlinedIcon />
            </button>
          ))}
          {members.length === 0 && <p>검색 결과가 없습니다.</p>}
        </div>
      </section>
    );
  }

  function renderMemberDetail() {
    if (!activeMember) return null;

    const itemsByDate = new Map<string, MemberLeaveCalendarItem[]>();
    memberCalendarItems.forEach((item) => {
      const date = String(item.date).slice(0, 10);
      itemsByDate.set(date, [...(itemsByDate.get(date) ?? []), item]);
    });

    return (
      <section className="attendance-member-detail">
        <div className="attendance-member-tabs" role="tablist">
          <button aria-selected={memberPanel === "calendar"} className={memberPanel === "calendar" ? "is-active" : ""} onClick={() => setMemberPanel("calendar")} role="tab" type="button">
            휴가 현황
          </button>
          <button aria-selected={memberPanel === "fixed"} className={memberPanel === "fixed" ? "is-active" : ""} onClick={() => setMemberPanel("fixed")} role="tab" type="button">
            고정 휴무
          </button>
        </div>

        {memberPanel === "calendar" ? (
          <section className="attendance-member-calendar" aria-label={`${activeMember.name} 휴가 달력`}>
            <header>
              <button aria-label="이전 달" onClick={() => setMemberCalendarMonth((month) => shiftMonth(month, -1))} type="button">
                <ChevronLeftOutlinedIcon />
              </button>
              <strong>{monthLabel(memberCalendarMonth)}</strong>
              <button aria-label="다음 달" onClick={() => setMemberCalendarMonth((month) => shiftMonth(month, 1))} type="button">
                <ChevronRightOutlinedIcon />
              </button>
            </header>
            {memberCalendarLoading ? (
              <p className="attendance-loading">휴가 현황을 불러오는 중입니다.</p>
            ) : (
              <div className="attendance-calendar-grid">
                {WEEKDAYS.map((weekday) => <span className={`is-${weekday.key.toLowerCase()}`} key={weekday.key}>{weekday.short}</span>)}
                {calendarDays(memberCalendarMonth).map((day, index) => {
                  if (!day) return <span className="attendance-calendar-blank" key={`blank-${index}`} />;
                  const date = `${memberCalendarMonth}-${String(day).padStart(2, "0")}`;
                  const items = itemsByDate.get(date) ?? [];
                  return (
                    <div className="attendance-calendar-day" key={date}>
                      <b>{day}</b>
                      <div>
                        {items.slice(0, 2).map((item) => (
                          <em
                            aria-label={calendarReasonLabel(item)}
                            className={`is-${item.source.toLowerCase()} is-${String(item.type ?? "other").toLowerCase()}`}
                            key={`${item.source}-${item.id}`}
                            title={calendarReasonLabel(item)}
                          >
                            {calendarReasonLabel(item)}
                          </em>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section className="attendance-fixed-rules">
            <header>
              <div>
                <span>고정 휴무</span>
                <p>정해진 요일과 교시에 자동 반영됩니다.</p>
              </div>
              <button onClick={openFixedForm} type="button"><AddOutlinedIcon /> 등록</button>
            </header>
            {fixedRulesLoading ? <p className="attendance-loading">고정 휴무를 불러오는 중입니다.</p> : null}
            {!fixedRulesLoading && fixedRules.length === 0 ? <p className="attendance-empty-state">등록된 고정 휴무가 없습니다.</p> : null}
            <div className="attendance-rule-list">
              {fixedRules.map((rule) => (
                <article key={rule.id}>
                  <div>
                    <strong>매주 {WEEKDAYS.find((weekday) => weekday.key === rule.dayOfWeek)?.label}</strong>
                    <span>{rule.slots.map((slot) => workSlots.find((item) => item.slot === slot)?.label ?? `${slot}교시`).join(" · ")}</span>
                    <small>{rule.reason}</small>
                  </div>
                  <button onClick={() => setLeaveCancelDialog({
                    coverage: {
                      source: "FIXED_LEAVE",
                      sourceId: rule.id,
                      user: { id: rule.userId, name: activeMember.name, branchId: activeMember.branchId },
                      leaveType: null,
                      slots: rule.slots,
                      reason: rule.reason,
                      status: "ACTIVE",
                    },
                    slotLabel: "전체 기간",
                    scope: "rule",
                  })} type="button">
                    종료
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    );
  }

  return (
    <section className="admin-card attendance-workspace">
      <header className="attendance-workspace-head">
        <div className="attendance-workspace-title">
          {workspaceView === "attendance" ? (
            <FactCheckOutlinedIcon />
          ) : (
            <button
              aria-label={
                workspaceView === "member-list"
                  ? "출석표로 돌아가기"
                  : "회원 목록으로 돌아가기"
              }
              className="attendance-header-back"
              onClick={() =>
                setWorkspaceView(
                  workspaceView === "member-list"
                    ? "attendance"
                    : "member-list",
                )
              }
              type="button"
            >
              <ChevronLeftOutlinedIcon />
            </button>
          )}
          <div>
            <span>
              {workspaceView === "attendance"
                ? "출석부"
                : workspaceView === "member-list"
                  ? "휴가 및 고정 휴무"
                  : activeMember?.name ?? "회원 휴가 관리"}
            </span>
            <p>
              {workspaceView === "attendance"
                ? "교시별 출석과 휴가를 바로 반영합니다."
                : workspaceView === "member-list"
                  ? "회원을 선택해 휴가 현황과 반복 휴무를 관리합니다."
                  : "휴가 및 고정 휴무 현황"}
            </p>
          </div>
        </div>
        {workspaceView === "member-list" && (
          <strong className="attendance-member-count">{members.length}명</strong>
        )}
        {workspaceView === "member-detail" &&
          activeMember &&
          onViewPayments && (
            <button
              className="attendance-payment-link"
              onClick={() =>
                onViewPayments(activeMember.id, activeMember.name)
              }
              type="button"
            >
              <PaymentsOutlinedIcon />
              결제 내역
            </button>
          )}
      </header>

      {error && <p className="admin-error">{error}</p>}

      {workspaceView === "member-list" ? renderMemberDirectory() : null}
      {workspaceView === "member-detail" ? renderMemberDetail() : null}

      {workspaceView === "attendance" && (
        <>
          <div className="attendance-toolbar">
            <label className="attendance-search-field">
              <SearchOutlinedIcon />
              <input onChange={(event) => setSearch(event.target.value)} placeholder="이름 검색" value={search} />
            </label>
            <div className="attendance-date-control">
              <button aria-label="이전 날짜" onClick={() => setSelectedDate((date) => shiftDate(date, -1))} type="button"><ChevronLeftOutlinedIcon /></button>
              <input aria-label="출석 날짜" onChange={(event) => setSelectedDate(event.target.value)} type="date" value={selectedDate} />
              <button aria-label="다음 날짜" onClick={() => setSelectedDate((date) => shiftDate(date, 1))} type="button"><ChevronRightOutlinedIcon /></button>
            </div>
            <button className="attendance-manage-button" onClick={() => setWorkspaceView("member-list")} type="button">
              <EventRepeatOutlinedIcon /> 휴가 관리
            </button>
          </div>

          <div className="attendance-shortcuts">
            <button onClick={() => setWorkspaceView("member-list")} type="button"><span>휴가 적용</span><b>{coverage.length}</b></button>
            <button onClick={() => setPaintStatus("EXCUSED")} type="button"><span>기타 기록</span><b>{excusedCount}</b></button>
            <span>{dateLabel(selectedDate)}</span>
          </div>

          <div className="attendance-table-scroll" aria-label="교시별 출석표">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th scope="col">이름</th>
                  {workSlots.map((slot) => <th key={slot.slot} scope="col">{compactSlotLabel(slot)}</th>)}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <th scope="row">
                      <button onClick={() => openMemberDetail(member.id)} title={`${member.name} 휴가 현황`} type="button">{member.name}</button>
                    </th>
                    {workSlots.map((slot) => {
                      const record = recordMap.get(recordKey(member.id, slot.slot));
                      const userCoverage = coverageByUser.get(member.id);
                      const covered = userCoverage && coverageAppliesToSlot(userCoverage, slot.slot, workSlots) ? userCoverage : null;
                      const cellStatus = covered ? "is-leave" : statusClass(record?.status);
                      const excusedLabel = record?.status === "EXCUSED" ? record.reasonType?.trim() || "기타" : "";
                      const cellLabel = covered
                        ? coverageReason(covered)
                        : record?.status === "EXCUSED"
                          ? excusedLabel
                          : record
                            ? STATUS_TABLE_LABEL[record.status as AttendanceStatusName] ?? "기타"
                            : "–";
                      const excusedDetail = [record?.reasonType, record?.reason].filter(Boolean).join(" · ");
                      const cellTitle = covered
                        ? `${member.name} · ${coverageReason(covered)} · 취소`
                        : `${member.name} · ${slot.label} · ${record?.status === "EXCUSED" ? excusedDetail || "기타" : record ? STATUS_TITLE[record.status as AttendanceStatusName] ?? "기타" : "미기록"}`;
                      const key = recordKey(member.id, slot.slot);
                      return (
                        <td key={slot.slot}>
                          <button
                            aria-label={cellTitle}
                            className={["attendance-cell", cellStatus, covered?.source === "FIXED_LEAVE" ? "is-fixed" : "", selected?.userId === member.id && selected.slot === slot.slot ? "is-selected" : ""].filter(Boolean).join(" ")}
                            disabled={savingKey === key}
                            onClick={() => void paintCell(member.id, slot.slot)}
                            title={cellTitle}
                            type="button"
                          >
                            {cellLabel}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {members.length === 0 && <p className="attendance-empty-state">검색 결과가 없습니다.</p>}
          </div>

          <div className="attendance-action-dock" role="group" aria-label="출석 상태 선택">
            {STATUS_OPTIONS.map((option) => (
              <button aria-pressed={paintStatus === option.value} className={[`is-${option.value.toLowerCase()}`, paintStatus === option.value ? "is-active" : ""].filter(Boolean).join(" ")} key={option.value} onClick={() => setPaintStatus(option.value)} type="button">
                <b>{STATUS_CELL_LABEL[option.value]}</b>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {reasonDialog && (
        <div className="attendance-modal-backdrop" role="presentation">
          <section aria-modal="true" className="attendance-modal" role="dialog">
            <header>
              <div><span>기타 사유 입력</span><strong>{reasonDialog.userName}</strong></div>
              <button aria-label="닫기" className="attendance-icon-button" onClick={() => setReasonDialog(null)} type="button"><CloseOutlinedIcon /></button>
            </header>
            <label className="attendance-form-field">날짜<input onChange={(event) => setReasonDialog((current) => current ? { ...current, date: event.target.value } : current)} type="date" value={reasonDialog.date} /></label>
            <section className="attendance-form-section">
              <span>교시</span>
              <div className="attendance-period-picker">
                {workSlots.map((slot) => <button aria-label={slot.label} className={reasonDialog.slots.includes(slot.slot) ? "is-active" : ""} key={slot.slot} onClick={() => toggleReasonSlot(slot.slot)} type="button">{compactSlotLabel(slot)}</button>)}
              </div>
              <button className="attendance-select-all" onClick={() => setReasonDialog((current) => current ? { ...current, slots: workSlots.map((slot) => slot.slot) } : current)} type="button">전체 선택</button>
            </section>
            <section className="attendance-form-section">
              <span>사유 선택</span>
              <div className="attendance-reason-grid">
                {REASON_TYPES.map((reasonType) => <button className={reasonDialog.reasonType === reasonType ? "is-active" : ""} key={reasonType} onClick={() => setReasonDialog((current) => current ? { ...current, reasonType } : current)} type="button">{reasonType}</button>)}
              </div>
            </section>
            <label className="attendance-form-field">사유 입력<input onChange={(event) => setReasonDialog((current) => current ? { ...current, reason: event.target.value } : current)} placeholder="예: 병원 방문" value={reasonDialog.reason} /></label>
            <div className="attendance-modal-actions"><button onClick={() => setReasonDialog(null)} type="button">닫기</button><button disabled={reasonSaving} onClick={() => void saveReason()} type="button">{reasonSaving ? "저장 중" : "저장"}</button></div>
          </section>
        </div>
      )}

      {fixedForm && activeMember && (
        <div className="attendance-modal-backdrop" role="presentation">
          <section aria-modal="true" className="attendance-modal attendance-fixed-form" role="dialog">
            <header>
              <div><span>고정 휴무 등록</span><strong>{activeMember.name}</strong></div>
              <button aria-label="닫기" className="attendance-icon-button" onClick={() => setFixedForm(null)} type="button"><CloseOutlinedIcon /></button>
            </header>
            <div className="attendance-date-pair">
              <label className="attendance-form-field">시작일<input onChange={(event) => setFixedForm((current) => current ? { ...current, startDate: event.target.value } : current)} type="date" value={fixedForm.startDate} /></label>
              <label className="attendance-form-field">종료일<input onChange={(event) => setFixedForm((current) => current ? { ...current, endDate: event.target.value } : current)} type="date" value={fixedForm.endDate} /></label>
            </div>
            <section className="attendance-form-section"><span>반복 요일</span><div className="attendance-weekday-grid">{WEEKDAYS.map((weekday) => <button className={fixedForm.dayOfWeek === weekday.key ? "is-active" : ""} key={weekday.key} onClick={() => setFixedForm((current) => current ? { ...current, dayOfWeek: weekday.key } : current)} type="button">{weekday.short}</button>)}</div></section>
            <section className="attendance-form-section"><span>적용 교시</span><div className="attendance-period-picker">{workSlots.map((slot) => <button aria-label={slot.label} className={fixedForm.slots.includes(slot.slot) ? "is-active" : ""} key={slot.slot} onClick={() => toggleFixedSlot(slot.slot)} type="button">{compactSlotLabel(slot)}</button>)}</div></section>
            <label className="attendance-form-field">사유<input onChange={(event) => setFixedForm((current) => current ? { ...current, reason: event.target.value } : current)} placeholder="예: 학원 일정, 정기 근무" value={fixedForm.reason} /></label>
            <div className="attendance-modal-actions"><button onClick={() => setFixedForm(null)} type="button">닫기</button><button disabled={fixedSaving} onClick={() => void saveFixedLeave()} type="button">{fixedSaving ? "등록 중" : "고정 휴무 등록"}</button></div>
          </section>
        </div>
      )}

      {leaveCancelDialog && (
        <div className="attendance-modal-backdrop" role="presentation">
          <section aria-modal="true" className="attendance-modal attendance-cancel-dialog" role="dialog">
            <header><div><span>{leaveCancelDialog.scope === "rule" ? "고정 휴무 규칙 종료" : "휴가 적용 취소"}</span><strong>{leaveCancelDialog.coverage.user.name}</strong></div><button aria-label="닫기" className="attendance-icon-button" onClick={() => setLeaveCancelDialog(null)} type="button"><CloseOutlinedIcon /></button></header>
            <p>{leaveCancelDialog.scope === "rule" ? "이 규칙을 종료하면 이후 날짜에 자동 반영되지 않습니다." : leaveCancelDialog.coverage.source === "FIXED_LEAVE" ? `${dateLabel(selectedDate)}의 고정 휴무만 취소합니다. 다음 주 규칙은 유지됩니다.` : `${dateLabel(selectedDate)}의 휴가 적용을 취소합니다.`}</p>
            <dl><div><dt>적용</dt><dd>{leaveCancelDialog.slotLabel}</dd></div><div><dt>사유</dt><dd>{coverageReason(leaveCancelDialog.coverage)}</dd></div></dl>
            <div className="attendance-modal-actions"><button disabled={leaveCancelling} onClick={() => setLeaveCancelDialog(null)} type="button">유지</button><button disabled={leaveCancelling} onClick={() => void cancelLeaveCoverage()} type="button">{leaveCancelling ? "처리 중" : "취소하기"}</button></div>
          </section>
        </div>
      )}
    </section>
  );
}
