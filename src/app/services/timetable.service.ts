import { http } from "./http";
import type { TimetableSlot } from "../../lib/types";

/** TIMETABLE API **/

export async function getTimetable(): Promise<TimetableSlot[]> {
  const { data } = await http.get<TimetableSlot[]>("/timetable");
  return data;
}
