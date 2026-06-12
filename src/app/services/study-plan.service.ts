import { http } from "./http";
import type {
  DayOfWeekName,
  MonthlyGoalRecord,
  WeeklyPlanRecord,
} from "../../lib/types";

/** STUDY PLAN API **/

export async function getMonthlyGoal(
  month: string,
): Promise<MonthlyGoalRecord | null> {
  const { data } = await http.get<MonthlyGoalRecord | null>(
    "/study-plans/monthly",
    { params: { month } },
  );
  return data;
}

export async function saveMonthlyGoal(input: {
  month: string;
  goal: string;
}): Promise<MonthlyGoalRecord> {
  const { data } = await http.post<MonthlyGoalRecord>(
    "/study-plans/monthly",
    input,
  );
  return data;
}

export async function getWeeklyPlan(
  weekStart: string,
): Promise<WeeklyPlanRecord | null> {
  const { data } = await http.get<WeeklyPlanRecord | null>(
    "/study-plans/weekly",
    { params: { weekStart } },
  );
  return data;
}

export async function saveWeeklyPlan(input: {
  weekStart: string;
  memo?: string;
  tasks?: Array<{
    dayOfWeek: DayOfWeekName;
    slot: number;
    title: string;
    isDone?: boolean;
    order?: number;
  }>;
}): Promise<WeeklyPlanRecord> {
  const { data } = await http.post<WeeklyPlanRecord>(
    "/study-plans/weekly",
    input,
  );
  return data;
}
