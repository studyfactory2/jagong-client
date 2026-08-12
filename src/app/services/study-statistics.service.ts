import { http } from "./http";
import type {
  MonthlyStudyReport,
  MyStudyStatistics,
  OvernightVoluntaryStudyReport,
  WeeklyStudyLeaderboard,
} from "../../lib/types";

/** STUDY STATISTICS API **/

export async function getMyStudyStatistics(): Promise<MyStudyStatistics> {
  const { data } = await http.get<MyStudyStatistics>("/study-statistics/me");
  return data;
}

export async function getMyMonthlyStudyReport(
  month: string,
): Promise<MonthlyStudyReport> {
  const { data } = await http.get<MonthlyStudyReport>(
    "/study-statistics/me/monthly",
    { params: { month } },
  );
  return data;
}

export async function getWeeklyStudyLeaderboard(): Promise<WeeklyStudyLeaderboard> {
  const { data } = await http.get<WeeklyStudyLeaderboard>(
    "/study-statistics/leaderboard/weekly",
  );
  return data;
}

export async function getMemberOvernightVoluntaryStudy(
  memberId: string,
  date: string,
): Promise<OvernightVoluntaryStudyReport> {
  const { data } = await http.get<OvernightVoluntaryStudyReport>(
    `/study-statistics/members/${memberId}/voluntary/overnight`,
    { params: { date } },
  );
  return data;
}
