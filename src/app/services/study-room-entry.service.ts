import { http } from "./http";
import type {
  StudyRoomEntryAccess,
  StudyRoomEntryGrant,
} from "../../lib/types";

/** STUDY ROOM ENTRY API **/

export async function getMyStudyRoomEntryAccess(): Promise<StudyRoomEntryAccess> {
  const { data } = await http.get<StudyRoomEntryAccess>(
    "/study-room-entry/me",
  );
  return data;
}

export async function grantMemberStudyRoomEntry(
  memberId: string,
): Promise<StudyRoomEntryGrant> {
  const { data } = await http.post<StudyRoomEntryGrant>(
    "/study-room-entry/members/" + memberId + "/grant",
  );
  return data;
}
