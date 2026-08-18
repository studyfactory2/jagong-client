import { http } from "./http";
import type {
  StudyRoomEntryAccess,
} from "../../lib/types";

/** STUDY ROOM ENTRY API **/

export async function getMyStudyRoomEntryAccess(): Promise<StudyRoomEntryAccess> {
  const { data } = await http.get<StudyRoomEntryAccess>(
    "/study-room-entry/me",
  );
  return data;
}
