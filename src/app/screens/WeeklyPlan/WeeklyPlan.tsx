import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import {
  getMonthlyGoal,
  getStudyPlanHistory,
  getWeeklyPlan,
  saveMonthlyGoal,
  saveWeeklyPlan,
} from "../../services/study-plan.service";
import { isMembershipAccessError } from "../../utils/access";
import type {
  DayOfWeekName,
  WeeklyPlanRecord,
  WeeklyPlanTaskRecord,
} from "../../../lib/types";
import "./weekly-plan.css";

const DAYS: Array<{ key: DayOfWeekName; label: string }> = [
  { key: "MON", label: "월" },
  { key: "TUE", label: "화" },
  { key: "WED", label: "수" },
  { key: "THU", label: "목" },
  { key: "FRI", label: "금" },
  { key: "SAT", label: "토" },
  { key: "SUN", label: "일" },
];

const PERIODS = [
  { slot: 1, label: "1교시", minutes: 90 },
  { slot: 2, label: "2교시", minutes: 80 },
  { slot: 0, label: "점심", minutes: 75, break: true },
  { slot: 3, label: "3교시", minutes: 70 },
  { slot: 4, label: "4교시", minutes: 90 },
  { slot: 5, label: "5교시", minutes: 80 },
  { slot: 0, label: "저녁", minutes: 75, break: true },
  { slot: 6, label: "6교시", minutes: 80 },
  { slot: 7, label: "7교시", minutes: 80 },
];

const SEOUL_TIME_ZONE = "Asia/Seoul";
const UNSAVED_CHANGES_MESSAGE =
  "저장하지 않은 변경사항이 있습니다. 이동할까요?";

type DraftTask = {
  dayOfWeek: DayOfWeekName;
  slot: number;
  title: string;
  isDone: boolean;
};

type DraftMap = Record<string, DraftTask[]>;

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function monthKey(date: Date) {
  return dateKey(date).slice(0, 7);
}

function startOfWeek(date: Date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffToMonday = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - diffToMonday);
  return copy;
}

function currentSeoulDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function currentSeoulWeekStartKey() {
  const [year, month, day] = currentSeoulDateKey().split("-").map(Number);
  const calendarDay = new Date(Date.UTC(year, month - 1, day));
  const diffToMonday = (calendarDay.getUTCDay() + 6) % 7;
  calendarDay.setUTCDate(calendarDay.getUTCDate() - diffToMonday);
  return calendarDay.toISOString().slice(0, 10);
}

function dateFromKey(value: string) {
  return new Date(`${value}T00:00:00`);
}

function historyRangeLabel(plan: WeeklyPlanRecord) {
  const format = (value: string, includeYear: boolean) => {
    const [year, month, day] = value.split("-").map(Number);
    return includeYear ? `${year}.${month}.${day}` : `${month}.${day}`;
  };
  return `${format(plan.weekStart, true)} – ${format(plan.weekEnd, false)}`;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function taskKey(dayOfWeek: DayOfWeekName, slot: number) {
  return dayOfWeek + ":" + slot;
}

function emptyTask(dayOfWeek: DayOfWeekName, slot: number): DraftTask {
  return { dayOfWeek, slot, title: "", isDone: false };
}

function toDraft(tasks: WeeklyPlanTaskRecord[]): DraftMap {
  return [...tasks]
    .sort((a, b) => a.order - b.order)
    .reduce<DraftMap>((acc, task) => {
      const key = taskKey(task.dayOfWeek, task.slot);
      acc[key] = [
        ...(acc[key] ?? []),
        {
          dayOfWeek: task.dayOfWeek,
          slot: task.slot,
          title: task.title,
          isDone: task.isDone,
        },
      ];
      return acc;
    }, {});
}

function filledTasks(tasks: DraftMap) {
  return Object.values(tasks)
    .flat()
    .filter((task) => task.title.trim());
}

function screenError(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function WeeklyPlan() {
  const navigate = useNavigate();
  const location = useLocation();
  const shouldOpenBoard =
    new URLSearchParams(location.search).get("view") === "board" ||
    (location.state as { focus?: string } | null)?.focus === "board";
  const [boardMode, setBoardMode] = useState(() => shouldOpenBoard);
  const [weekStart, setWeekStart] = useState(currentSeoulWeekStartKey);
  const [calendarMonthDate, setCalendarMonthDate] = useState(() => {
    const today = dateFromKey(currentSeoulDateKey());
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [goal, setGoal] = useState("");
  const [loadedGoal, setLoadedGoal] = useState("");
  const [memo, setMemo] = useState("");
  const [tasks, setTasks] = useState<DraftMap>({});
  const [history, setHistory] = useState<WeeklyPlanRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [currentWeekStart, setCurrentWeekStart] = useState(
    currentSeoulWeekStartKey,
  );
  const [loading, setLoading] = useState(true);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [hasLoadedPlan, setHasLoadedPlan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saved">(
    "idle",
  );
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const historyIndexRef = useRef<number | null>(null);
  const restoringHistoryRef = useRef(false);

  const weekStartDate = useMemo(
    () => new Date(weekStart + "T00:00:00"),
    [weekStart],
  );
  const weekEndDate = useMemo(() => addDays(weekStartDate, 6), [weekStartDate]);
  const weekDays = useMemo(
    () =>
      DAYS.map((day, index) => ({
        ...day,
        date: addDays(weekStartDate, index),
      })),
    [weekStartDate],
  );
  const calendarMonth = monthKey(calendarMonthDate);
  const planMonth = weekStart.slice(0, 7);
  const calendarDays = useMemo(() => {
    const firstDay = new Date(
      calendarMonthDate.getFullYear(),
      calendarMonthDate.getMonth(),
      1,
    );
    const start = startOfWeek(firstDay);
    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(start, index);
      const key = dateKey(date);
      const isCurrentMonth = date.getMonth() === calendarMonthDate.getMonth();
      const isSelectedWeek =
        key >= weekStart && key <= dateKey(weekEndDate);
      return { date, key, isCurrentMonth, isSelectedWeek };
    });
  }, [calendarMonthDate, weekEndDate, weekStart]);
  const taskList = filledTasks(tasks);
  const doneCount = taskList.filter((task) => task.isDone).length;
  const membershipLocked = isMembershipAccessError(error);
  const isPastWeek = weekStart < currentWeekStart;
  const draftLocked = isPastWeek || loading || saving || !hasLoadedPlan;
  const pastPlans = useMemo(
    () =>
      history
        .filter((plan) => plan.weekStart < currentWeekStart)
        .sort((left, right) => right.weekStart.localeCompare(left.weekStart)),
    [currentWeekStart, history],
  );

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setHasLoadedPlan(false);
      setError("");
      try {
        const [goalData, weekData] = await Promise.all([
          getMonthlyGoal(planMonth),
          getWeeklyPlan(weekStart),
        ]);
        if (!alive) return;
        const nextGoal = isPastWeek
          ? (weekData?.monthlyGoal?.goal ?? goalData?.goal ?? "")
          : (goalData?.goal ?? "");
        setGoal(nextGoal);
        setLoadedGoal(nextGoal);
        setMemo(weekData?.memo ?? "");
        setTasks(toDraft(weekData?.tasks ?? []));
        setSaveState("idle");
        setIsEditingPlan(false);
        setHasLoadedPlan(true);
      } catch (err) {
        if (!alive) return;
        setGoal("");
        setLoadedGoal("");
        setMemo("");
        setTasks({});
        setHasLoadedPlan(false);
        setError(screenError(err, "주간계획을 불러오지 못했습니다."));
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [currentWeekStart, isPastWeek, planMonth, reloadVersion, weekStart]);

  useEffect(() => {
    let alive = true;

    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError("");
      try {
        const plans = await getStudyPlanHistory(12);
        if (alive) setHistory(plans);
      } catch (err) {
        if (alive) {
          setHistoryError(
            screenError(err, "지난 계획을 불러오지 못했습니다."),
          );
        }
      } finally {
        if (alive) setHistoryLoading(false);
      }
    }

    void loadHistory();
    return () => {
      alive = false;
    };
  }, [currentWeekStart]);

  useEffect(() => {
    const refreshWeekBoundary = () => {
      if (document.visibilityState !== "visible") return;
      setCurrentWeekStart(currentSeoulWeekStartKey());
    };
    const timer = window.setInterval(refreshWeekBoundary, 60_000);
    window.addEventListener("focus", refreshWeekBoundary);
    document.addEventListener("visibilitychange", refreshWeekBoundary);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWeekBoundary);
      document.removeEventListener("visibilitychange", refreshWeekBoundary);
    };
  }, []);

  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = window.setTimeout(() => setSaveState("idle"), 800);
    return () => window.clearTimeout(timer);
  }, [saveState]);

  useEffect(() => {
    if (saveState !== "dirty" && !saving) return;
    const confirmPageExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", confirmPageExit);
    return () => window.removeEventListener("beforeunload", confirmPageExit);
  }, [saveState, saving]);

  useEffect(() => {
    const index = window.history.state?.idx;
    historyIndexRef.current = typeof index === "number" ? index : null;
  }, [location.key]);

  useEffect(() => {
    if (saveState !== "dirty" && !saving) return;

    const confirmHistoryNavigation = (event: PopStateEvent) => {
      if (restoringHistoryRef.current) {
        restoringHistoryRef.current = false;
        event.stopImmediatePropagation();
        return;
      }

      const nextIndex = event.state?.idx;
      const currentIndex = historyIndexRef.current;
      const restoreDelta =
        typeof nextIndex === "number" && currentIndex !== null
          ? currentIndex - nextIndex
          : 0;
      if (
        typeof nextIndex !== "number" ||
        currentIndex === null ||
        restoreDelta === 0
      ) {
        return;
      }
      if (!saving && window.confirm(UNSAVED_CHANGES_MESSAGE)) {
        return;
      }

      event.stopImmediatePropagation();
      restoringHistoryRef.current = true;
      window.history.go(restoreDelta);
    };

    window.addEventListener("popstate", confirmHistoryNavigation, {
      capture: true,
    });
    return () => {
      window.removeEventListener("popstate", confirmHistoryNavigation, {
        capture: true,
      });
      restoringHistoryRef.current = false;
    };
  }, [saveState, saving]);

  function confirmDiscardChanges() {
    return (
      saveState !== "dirty" ||
      window.confirm(UNSAVED_CHANGES_MESSAGE)
    );
  }

  function retryLoad() {
    if (loading || saving) return;
    setReloadVersion((version) => version + 1);
  }

  function selectWeek(nextWeekStart: string, nextMonthDate: Date) {
    if (saving) return;
    if (nextWeekStart === weekStart) {
      setCalendarMonthDate(nextMonthDate);
      return;
    }
    if (!confirmDiscardChanges()) return;
    setLoading(true);
    setHasLoadedPlan(false);
    setGoal("");
    setLoadedGoal("");
    setMemo("");
    setTasks({});
    setError("");
    setSaveState("idle");
    setIsEditingPlan(false);
    setWeekStart(nextWeekStart);
    setCalendarMonthDate(nextMonthDate);
  }

  function leaveWeeklyPlan() {
    if (saving) return;
    if (confirmDiscardChanges()) navigate("/waiting-room");
  }

  function openPayments() {
    if (saving) return;
    if (confirmDiscardChanges()) navigate("/payments");
  }

  function moveWeek(delta: number) {
    const nextWeekStart = addDays(weekStartDate, delta * 7);
    selectWeek(
      dateKey(nextWeekStart),
      new Date(nextWeekStart.getFullYear(), nextWeekStart.getMonth(), 1),
    );
  }

  function moveMonth(delta: number) {
    const nextMonth = addMonths(calendarMonthDate, delta);
    selectWeek(dateKey(startOfWeek(nextMonth)), nextMonth);
  }

  function selectCalendarDate(date: Date) {
    selectWeek(
      dateKey(startOfWeek(date)),
      new Date(date.getFullYear(), date.getMonth(), 1),
    );
  }

  function selectHistoryPlan(plan: WeeklyPlanRecord) {
    const selected = dateFromKey(plan.weekStart);
    selectWeek(
      plan.weekStart,
      new Date(selected.getFullYear(), selected.getMonth(), 1),
    );
  }

  function updateTask(
    dayOfWeek: DayOfWeekName,
    slot: number,
    index: number,
    value: string,
  ) {
    if (draftLocked) return;
    const key = taskKey(dayOfWeek, slot);
    setSaveState("dirty");
    setTasks((current) => {
      const next = current[key]
        ? [...current[key]]
        : [emptyTask(dayOfWeek, slot)];
      next[index] = {
        ...(next[index] ?? emptyTask(dayOfWeek, slot)),
        title: value,
      };
      return { ...current, [key]: next };
    });
  }

  function toggleTask(dayOfWeek: DayOfWeekName, slot: number, index: number) {
    if (draftLocked) return;
    const key = taskKey(dayOfWeek, slot);
    if (!tasks[key]?.[index]?.title.trim()) return;
    setSaveState("dirty");
    setTasks((current) => {
      const next = current[key] ? [...current[key]] : [];
      const task = next[index];
      if (!task?.title.trim()) return current;
      next[index] = { ...task, isDone: !task.isDone };
      return { ...current, [key]: next };
    });
  }

  function addTask(dayOfWeek: DayOfWeekName, slot: number) {
    if (draftLocked) return;
    const key = taskKey(dayOfWeek, slot);
    setSaveState("dirty");
    setTasks((current) => ({
      ...current,
      [key]: [...(current[key] ?? []), emptyTask(dayOfWeek, slot)],
    }));
  }

  async function save() {
    const actualCurrentWeekStart = currentSeoulWeekStartKey();
    if (weekStart < actualCurrentWeekStart) {
      setCurrentWeekStart(actualCurrentWeekStart);
      setError("지난 주 계획은 수정할 수 없습니다.");
      return;
    }
    if (loading || saving || !hasLoadedPlan) return;
    const normalizedGoal = goal.trim();
    if (loadedGoal.trim() && !normalizedGoal) {
      setError("월간 목표는 빈 값으로 저장할 수 없습니다.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (normalizedGoal && normalizedGoal !== loadedGoal.trim()) {
        await saveMonthlyGoal({ month: planMonth, goal: normalizedGoal });
      }

      await saveWeeklyPlan({
        weekStart,
        memo: memo.trim(),
        tasks: Object.values(tasks).flatMap((cellTasks) =>
          cellTasks
            .filter((task) => task.title.trim())
            .map((task, order) => ({
              dayOfWeek: task.dayOfWeek,
              slot: task.slot,
              title: task.title.trim(),
              isDone: task.isDone,
              order,
            })),
        ),
      });
      setLoadedGoal(normalizedGoal);
      setSaveState("saved");
      setIsEditingPlan(false);
    } catch (err) {
      setError(screenError(err, "주간계획을 저장하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  }

  function renderHistory() {
    return (
      <section aria-labelledby="wp-history-title" className="wp-history">
        <header>
          <div>
            <HistoryOutlinedIcon />
            <div>
              <strong id="wp-history-title">지난 계획</strong>
              <span>저장된 주를 선택하면 읽기 전용으로 볼 수 있습니다.</span>
            </div>
          </div>
          <b>{pastPlans.length}주</b>
        </header>

        {historyLoading && <p>지난 계획을 불러오는 중입니다.</p>}
        {!historyLoading && historyError && (
          <p className="is-error">{historyError}</p>
        )}
        {!historyLoading && !historyError && pastPlans.length === 0 && (
          <p>저장된 지난 계획이 없습니다.</p>
        )}
        {!historyLoading && !historyError && pastPlans.length > 0 && (
          <div className="wp-history-list">
            {pastPlans.map((plan) => {
              const selected = plan.weekStart === weekStart;
              const title = plan.memo?.trim() || "주간 목표 없음";
              const progressText =
                plan.progress.total > 0
                  ? `완료 ${plan.progress.done}/${plan.progress.total}`
                  : "등록된 할 일 없음";

              return (
                <button
                  aria-label={`${historyRangeLabel(plan)}, ${title}, ${progressText}, ${plan.progress.percent}퍼센트${selected ? ", 선택됨" : ""}`}
                  aria-pressed={selected}
                  className={selected ? "is-selected" : ""}
                  disabled={saving}
                  key={plan.id ?? plan.weekStart}
                  onClick={() => selectHistoryPlan(plan)}
                  type="button"
                >
                  <span className="wp-history-date">
                    {historyRangeLabel(plan)}
                  </span>
                  {selected && (
                    <span className="wp-history-selected">선택됨</span>
                  )}
                  <strong className="wp-history-title">{title}</strong>
                  <span className="wp-history-progress">
                    <small>{progressText}</small>
                    <b>{plan.progress.percent}%</b>
                  </span>
                  <span className="wp-history-bar" aria-hidden="true">
                    <span
                      style={{ width: `${plan.progress.percent}%` }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  function renderReadOnlyNotice() {
    if (!isPastWeek) return null;
    return (
      <section className="wp-readonly-note" role="status">
        <LockOutlinedIcon />
        <div>
          <strong>지난 주 계획은 읽기 전용입니다.</strong>
          <span>주간 목표와 할 일 완료 기록을 그대로 보존합니다.</span>
        </div>
      </section>
    );
  }

  return (
    <div className="wp">
      <header className="wp-head">
        <button disabled={saving} onClick={leaveWeeklyPlan} type="button">
          <ArrowBackIcon /> 대기장
        </button>
        <h1>{boardMode ? "주간학습장" : "작업계획"}</h1>
        <button
          className={boardMode ? "wp-save is-direction" : "wp-save"}
          disabled={saving}
          onClick={() => setBoardMode((value) => !value)}
          type="button"
        >
          {boardMode ? <SaveOutlinedIcon /> : <EditNoteOutlinedIcon />}
          {boardMode ? "작업계획" : "학습장 →"}
        </button>
      </header>

      {error && (
        <div className="wp-error">
          <span>{error}</span>
          {membershipLocked && (
            <button disabled={saving} onClick={openPayments} type="button">
              이용권 결제하기
            </button>
          )}
          {!loading && !hasLoadedPlan && (
            <button onClick={retryLoad} type="button">
              다시 불러오기
            </button>
          )}
        </div>
      )}

      {!boardMode ? (
        <main className={`wp-body${isPastWeek ? " is-readonly" : ""}`}>
          {renderReadOnlyNotice()}
          <section className="wp-month-goal wp-monthly-goal">
            <label htmlFor="wp-monthly-goal">
              <EditNoteOutlinedIcon />
              {planMonth.replace("-", "년 ")}월 목표
            </label>
            <input
              id="wp-monthly-goal"
              maxLength={1000}
              value={goal}
              onChange={(event) => {
                if (saving) return;
                setGoal(event.target.value);
                setSaveState("dirty");
              }}
              placeholder="예) 재무회계 2회독 + 기출 300문제 완료"
              readOnly={
                draftLocked || !isEditingPlan
              }
            />
          </section>

          <section className="wp-calendar">
            <div className="wp-cal-head">
              <button
                aria-label="이전 달"
                disabled={saving}
                onClick={() => moveMonth(-1)}
                type="button"
              >
                {"<"}
              </button>
              <strong>{calendarMonth.replace("-", "년 ")}월</strong>
              <button
                aria-label="다음 달"
                disabled={saving}
                onClick={() => moveMonth(1)}
                type="button"
              >
                {">"}
              </button>
            </div>
            <div className="wp-weekdays">
              {DAYS.map((day) => (
                <span key={day.key}>{day.label}</span>
              ))}
            </div>
            <div className="wp-days">
              {calendarDays.map((day) => (
                <button
                  aria-label={`${day.key} 주 선택`}
                  aria-pressed={day.isSelectedWeek}
                  className={[
                    day.isCurrentMonth ? "" : "is-muted",
                    day.isSelectedWeek ? "is-picked" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={saving}
                  key={day.key}
                  onClick={() => selectCalendarDate(day.date)}
                  type="button"
                >
                  {day.date.getDate()}
                </button>
              ))}
            </div>
            <p>
              선택된 주: {weekStart} - {dateKey(weekEndDate)}
            </p>
          </section>

          {renderHistory()}

          <section className="wp-month-goal wp-week-goal">
            <label htmlFor="wp-weekly-goal">
              <MenuBookOutlinedIcon />
              선택한 주 목표
            </label>
            <input
              id="wp-weekly-goal"
              maxLength={1000}
              value={memo}
              onChange={(event) => {
                if (saving) return;
                setMemo(event.target.value);
                setSaveState("dirty");
              }}
              placeholder="예) 오전에는 기출, 오후에는 오답 정리"
              readOnly={
                draftLocked || !isEditingPlan
              }
            />
          </section>

          <section className="wp-actions">
            <button
              className="wp-edit-action"
              disabled={
                loading ||
                saving ||
                !hasLoadedPlan ||
                membershipLocked ||
                isPastWeek
              }
              onClick={() => setIsEditingPlan(true)}
              type="button"
            >
              <EditNoteOutlinedIcon />
              {isPastWeek ? "읽기 전용" : "수정"}
            </button>
            <button
              className="wp-main-action"
              disabled={
                loading ||
                saving ||
                !hasLoadedPlan ||
                membershipLocked ||
                isPastWeek ||
                !isEditingPlan
              }
              onClick={save}
              type="button"
            >
              <SaveOutlinedIcon />
              {saving ? "저장중" : saveState === "saved" ? "저장 완료" : "저장"}
            </button>
          </section>

          <section className="wp-stats">
            <div>
              <span>이번주 할 일</span>
              <strong>{taskList.length}개</strong>
            </div>
            <div>
              <span>완료</span>
              <strong>{doneCount}개</strong>
            </div>
          </section>
        </main>
      ) : (
        <main className={`wp-board${isPastWeek ? " is-readonly" : ""}`}>
          {renderReadOnlyNotice()}
          <section className="wp-month-goal wp-board-memo">
            <label htmlFor="wp-board-weekly-goal">
              <MenuBookOutlinedIcon />
              선택한 주 목표
            </label>
            <input
              id="wp-board-weekly-goal"
              maxLength={1000}
              value={memo}
              onChange={(event) => {
                if (saving) return;
                setMemo(event.target.value);
                setSaveState("dirty");
              }}
              placeholder="예) 오전에는 기출, 오후에는 오답 정리"
              readOnly={draftLocked}
            />
          </section>

          <section className="wp-table">
            <div className="wp-table-head">
              <b>교시</b>
              {weekDays.map((day) => (
                <b key={day.key}>
                  {day.label}
                  <small>
                    {day.date.getMonth() + 1}/{day.date.getDate()}
                  </small>
                </b>
              ))}
            </div>

            {PERIODS.map((period) =>
              period.break ? (
                <div className="wp-break" key={period.label}>
                  {period.label}시간 ({period.minutes}분)
                </div>
              ) : (
                <div className="wp-table-row" key={period.label}>
                  <div className="wp-period">
                    <strong>{period.label}</strong>
                    <span>{period.minutes}분</span>
                  </div>
                  {weekDays.map((day) => {
                    const key = taskKey(day.key, period.slot);
                    const cellTasks = tasks[key]?.length
                      ? tasks[key]
                      : [emptyTask(day.key, period.slot)];
                    return (
                      <div className="wp-cell" key={key}>
                        {cellTasks.map((task, index) => (
                          <div className="wp-cell-task" key={index}>
                            <button
                              aria-label={`${dateKey(day.date)} ${period.label} ${index + 1}번째 할 일 ${task.isDone ? "완료 취소" : "완료"}`}
                              aria-pressed={task.isDone}
                              disabled={draftLocked || !task.title.trim()}
                              onClick={() =>
                                toggleTask(day.key, period.slot, index)
                              }
                              type="button"
                            >
                              {task.isDone ? "✓" : ""}
                            </button>
                            <input
                              aria-label={`${dateKey(day.date)} ${period.label} ${index + 1}번째 할 일 내용`}
                              maxLength={200}
                              value={task.title}
                              onChange={(event) =>
                                updateTask(
                                  day.key,
                                  period.slot,
                                  index,
                                  event.target.value,
                                )
                              }
                              placeholder="+ 할 일"
                              readOnly={draftLocked}
                            />
                          </div>
                        ))}
                        <button
                          aria-label={`${dateKey(day.date)} ${period.label} 할 일 추가`}
                          className="wp-add-task"
                          disabled={draftLocked}
                          onClick={() => addTask(day.key, period.slot)}
                          type="button"
                        >
                          + 추가
                        </button>
                      </div>
                    );
                  })}
                </div>
              ),
            )}
          </section>

          <section className="wp-board-actions">
            <button
              disabled={saving}
              onClick={() => moveWeek(-1)}
              type="button"
            >
              지난주
            </button>
            <button
              disabled={saving}
              onClick={() => moveWeek(1)}
              type="button"
            >
              다음주
            </button>
            <button
              className="is-save"
              onClick={save}
              disabled={
                loading ||
                saving ||
                !hasLoadedPlan ||
                membershipLocked ||
                isPastWeek
              }
              type="button"
            >
              {isPastWeek ? "지난 계획 · 읽기 전용" : "이번 주 계획 저장하기"}
            </button>
          </section>
        </main>
      )}

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
