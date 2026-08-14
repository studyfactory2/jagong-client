import type { WorkroomMode } from "../../lib/types";

export const WORKROOM_MODE_ATTRIBUTE = "jagong.workroom.mode";

export function resolveWorkroomMode(value: unknown): WorkroomMode {
  return value === "group" ? "group" : "line";
}

export function resolveParticipantWorkroomMode(
  attributes?: Readonly<Record<string, string>>,
): WorkroomMode {
  return resolveWorkroomMode(attributes?.[WORKROOM_MODE_ATTRIBUTE]);
}
