import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import {
  getMonthlyGoal,
  getWeeklyPlan,
  saveMonthlyGoal,
  saveWeeklyPlan,
} from "../../services/study-plan.service";
import { isMembershipAccessError } from "../../utils/access";
import type { DayOfWeekName, WeeklyPlanTaskRecord } from "../../../lib/types";
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
  const [weekStart, setWeekStart] = useState(() =>
    dateKey(startOfWeek(new Date())),
  );
  const [calendarMonthDate, setCalendarMonthDate] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [goal, setGoal] = useState("");
  const [memo, setMemo] = useState("");
  const [tasks, setTasks] = useState<DraftMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saved">(
    "idle",
  );
  const [isEditingPlan, setIsEditingPlan] = useState(false);

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
  const month = monthKey(calendarMonthDate);
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

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [goalData, weekData] = await Promise.all([
          getMonthlyGoal(month),
          getWeeklyPlan(weekStart),
        ]);
        if (!alive) return;
        setGoal(goalData?.goal ?? "");
        setMemo(weekData?.memo ?? "");
        setTasks(toDraft(weekData?.tasks ?? []));
        setSaveState("idle");
        setIsEditingPlan(false);
      } catch (err) {
        if (!alive) return;
        setError(screenError(err, "주간계획을 불러오지 못했습니다."));
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [month, weekStart]);

  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = window.setTimeout(() => setSaveState("idle"), 800);
    return () => window.clearTimeout(timer);
  }, [saveState]);

  function moveWeek(delta: number) {
    const nextWeekStart = addDays(weekStartDate, delta * 7);
    setWeekStart(dateKey(nextWeekStart));
    setCalendarMonthDate(
      new Date(nextWeekStart.getFullYear(), nextWeekStart.getMonth(), 1),
    );
  }

  function moveMonth(delta: number) {
    const nextMonth = addMonths(calendarMonthDate, delta);
    setCalendarMonthDate(nextMonth);
    setWeekStart(dateKey(startOfWeek(nextMonth)));
  }

  function selectCalendarDate(date: Date) {
    setWeekStart(dateKey(startOfWeek(date)));
    setCalendarMonthDate(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  function updateTask(
    dayOfWeek: DayOfWeekName,
    slot: number,
    index: number,
    value: string,
  ) {
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
    const key = taskKey(dayOfWeek, slot);
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
    const key = taskKey(dayOfWeek, slot);
    setSaveState("dirty");
    setTasks((current) => ({
      ...current,
      [key]: [...(current[key] ?? []), emptyTask(dayOfWeek, slot)],
    }));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      if (goal.trim()) {
        await saveMonthlyGoal({ month, goal: goal.trim() });
      }

      await saveWeeklyPlan({
        weekStart,
        memo: memo.trim() || undefined,
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
      setSaveState("saved");
      setIsEditingPlan(false);
    } catch (err) {
      setError(screenError(err, "주간계획을 저장하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wp">
      <header className="wp-head">
        <button onClick={() => navigate("/waiting-room")} type="button">
          <ArrowBackIcon /> 대기장
        </button>
        <h1>{boardMode ? "주간학습장" : "작업계획"}</h1>
        <button
          className="wp-save"
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
            <button onClick={() => navigate("/payments")} type="button">
              이용권 결제하기
            </button>
          )}
        </div>
      )}

      {!boardMode ? (
        <main className="wp-body">
          <section className="wp-month-goal wp-monthly-goal">
            <label>
              <EditNoteOutlinedIcon />
              이번달 목표
            </label>
            <input
              value={goal}
              onChange={(event) => {
                setGoal(event.target.value);
                setSaveState("dirty");
              }}
              placeholder="예) 재무회계 2회독 + 기출 300문제 완료"
              readOnly={!isEditingPlan}
            />
          </section>

          <section className="wp-calendar">
            <div className="wp-cal-head">
              <button onClick={() => moveMonth(-1)} type="button">
                {"<"}
              </button>
              <strong>{month.replace("-", "년 ")}월</strong>
              <button onClick={() => moveMonth(1)} type="button">
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
                  className={[
                    day.isCurrentMonth ? "" : "is-muted",
                    day.isSelectedWeek ? "is-picked" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
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

          <section className="wp-month-goal wp-week-goal">
            <label>
              <MenuBookOutlinedIcon />
              이번주 목표
            </label>
            <input
              value={memo}
              onChange={(event) => {
                setMemo(event.target.value);
                setSaveState("dirty");
              }}
              placeholder="예) 오전에는 기출, 오후에는 오답 정리"
              readOnly={!isEditingPlan}
            />
          </section>

          <section className="wp-actions">
            <button
              className="wp-edit-action"
              disabled={loading || saving || membershipLocked}
              onClick={() => setIsEditingPlan(true)}
              type="button"
            >
              <EditNoteOutlinedIcon />
              수정
            </button>
            <button
              className="wp-main-action"
              disabled={loading || saving || membershipLocked || !isEditingPlan}
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
        <main className="wp-board">
          <section className="wp-board-top">
            <span>계획</span>
            <div>
              <strong>{month} 목표 작업량</strong>
              <p>{goal || "이번 달 목표를 먼저 작성해 주세요."}</p>
            </div>
            <button
              onClick={save}
              disabled={saving || membershipLocked}
              type="button"
            >
              {saving ? "저장중" : "저장"}
            </button>
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
                              onClick={() =>
                                toggleTask(day.key, period.slot, index)
                              }
                              type="button"
                            >
                              {task.isDone ? "✓" : ""}
                            </button>
                            <input
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
                            />
                          </div>
                        ))}
                        <button
                          className="wp-add-task"
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
            <button onClick={() => moveWeek(-1)} type="button">
              지난주
            </button>
            <button onClick={() => moveWeek(1)} type="button">
              다음주
            </button>
            <button
              className="is-save"
              onClick={save}
              disabled={saving || membershipLocked}
              type="button"
            >
              이번 주 계획 저장하기
            </button>
          </section>
        </main>
      )}

      <p className="app-foot">자격증공장 재택근무반</p>
    </div>
  );
}
