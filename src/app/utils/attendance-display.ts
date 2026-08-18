const SEOUL_TIME_ZONE = "Asia/Seoul";

type AttendanceArrivalRecord = {
  status: string;
  firstStudyAt?: string | null;
  lateSeconds?: number | null;
};

export type AttendanceArrivalDetail = {
  lateDuration: string | null;
  firstStudyClock: string | null;
};

export function formatLateDuration(
  seconds: number | null | undefined,
): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainder = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0) parts.push(`${minutes}분`);
  if (remainder > 0 || parts.length === 0) parts.push(`${remainder}초`);

  return parts.join(" ");
}

export function formatFirstStudyClock(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: SEOUL_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  const hour = part("hour");
  const minute = part("minute");
  const second = part("second");

  return hour && minute && second ? `${hour}:${minute}:${second}` : null;
}

export function getAttendanceArrivalDetail(
  record: AttendanceArrivalRecord | null | undefined,
): AttendanceArrivalDetail | null {
  if (!record) return null;
  const hasVerifiedArrival =
    record.status === "LATE" ||
    (record.status === "ABSENT" && Boolean(record.firstStudyAt));
  if (!hasVerifiedArrival) return null;

  return {
    lateDuration: formatLateDuration(record.lateSeconds),
    firstStudyClock: formatFirstStudyClock(record.firstStudyAt),
  };
}
