import { http } from "./http";
import type { StudyTimeStatus } from "../../lib/types";

/** STUDY TIME API **/

export async function getMyStudyTimeStatus(): Promise<StudyTimeStatus> {
  const { data } = await http.get<StudyTimeStatus>("/study-time/me");
  return data;
}

export async function startMyStudyBreak(): Promise<StudyTimeStatus> {
  const { data } = await http.post<StudyTimeStatus>("/study-time/break");
  return data;
}

export async function resumeMyStudy(): Promise<StudyTimeStatus> {
  const { data } = await http.post<StudyTimeStatus>("/study-time/resume");
  return data;
}
