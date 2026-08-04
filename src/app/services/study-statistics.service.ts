import { http } from "./http";
import type { WeeklyStudyLeaderboard } from "../../lib/types";

/** STUDY STATISTICS API **/

export async function getWeeklyStudyLeaderboard(): Promise<WeeklyStudyLeaderboard> {
  const { data } = await http.get<WeeklyStudyLeaderboard>(
    "/study-statistics/leaderboard/weekly",
  );
  return data;
}
