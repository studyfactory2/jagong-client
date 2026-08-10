import type { StudyTimeStatus, TimetableSlot } from "../../lib/types";

const OVERNIGHT_START_MINUTE = 22 * 60;
const OVERNIGHT_END_MINUTE = 9 * 60;

export const WORKROOM_FALLBACK_TIMETABLE: TimetableSlot[] = [
  {
    slot: 0,
    label: "출근",
    startTime: "08:00",
    endTime: "09:00",
    duration: 60,
    isBreak: false,
  },
  {
    slot: 1,
    label: "1교시",
    startTime: "09:00",
    endTime: "10:30",
    duration: 90,
    isBreak: false,
  },
  {
    slot: 2,
    label: "쉬는시간",
    startTime: "10:30",
    endTime: "10:45",
    duration: 15,
    isBreak: true,
  },
  {
    slot: 3,
    label: "2교시",
    startTime: "10:45",
    endTime: "12:05",
    duration: 80,
    isBreak: false,
  },
  {
    slot: 4,
    label: "점심",
    startTime: "12:05",
    endTime: "13:20",
    duration: 75,
    isBreak: true,
  },
  {
    slot: 5,
    label: "3교시",
    startTime: "13:20",
    endTime: "14:30",
    duration: 70,
    isBreak: false,
  },
  {
    slot: 6,
    label: "쉬는시간",
    startTime: "14:30",
    endTime: "14:45",
    duration: 15,
    isBreak: true,
  },
  {
    slot: 7,
    label: "4교시",
    startTime: "14:45",
    endTime: "16:15",
    duration: 90,
    isBreak: false,
  },
  {
    slot: 8,
    label: "쉬는시간",
    startTime: "16:15",
    endTime: "16:30",
    duration: 15,
    isBreak: true,
  },
  {
    slot: 9,
    label: "5교시",
    startTime: "16:30",
    endTime: "17:50",
    duration: 80,
    isBreak: false,
  },
  {
    slot: 10,
    label: "저녁",
    startTime: "17:50",
    endTime: "19:05",
    duration: 75,
    isBreak: true,
  },
  {
    slot: 11,
    label: "6교시",
    startTime: "19:05",
    endTime: "20:25",
    duration: 80,
    isBreak: false,
  },
  {
    slot: 12,
    label: "쉬는시간",
    startTime: "20:25",
    endTime: "20:40",
    duration: 15,
    isBreak: true,
  },
  {
    slot: 13,
    label: "7교시",
    startTime: "20:40",
    endTime: "22:00",
    duration: 80,
    isBreak: false,
  },
];

export type StudyRecordingWindowKind =
  | "OVERNIGHT"
  | "REGULAR_STUDY"
  | "REGULAR_BREAK"
  | "SLOT0"
  | "UNAVAILABLE"
  | "UNKNOWN";

export type StudyRecordingWindow = {
  canMemberStart: boolean;
  current: TimetableSlot | undefined;
  kind: StudyRecordingWindowKind;
  seoulSeconds: number;
};

export type StudyRecordingView = {
  action: "BREAK" | "RESUME" | null;
  actionLabel: string | null;
  detail: string;
  label: string;
  tone: "study" | "break" | "schedule" | "system" | "syncing";
};

const seoulClockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const studyStateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
});

function timetableTimeToMinute(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return Number.NaN;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return Number.NaN;
  }
  return hour * 60 + minute;
}

function seoulSecondsSinceMidnight(date: Date): number {
  const parts = seoulClockFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return value("hour") * 3600 + value("minute") * 60 + value("second");
}

function isMinuteInRange(
  currentMinute: number,
  startTime: string,
  endTime: string,
): boolean {
  const start = timetableTimeToMinute(startTime);
  const end = timetableTimeToMinute(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  if (start <= end) return start <= currentMinute && currentMinute < end;
  return currentMinute >= start || currentMinute < end;
}

function studyStateStartedAt(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : `${studyStateTimeFormatter.format(date)}부터`;
}

export function resolveStudyRecordingWindow(
  timetable: readonly TimetableSlot[],
  timetableLoaded: boolean,
  referenceAt: Date,
): StudyRecordingWindow {
  const seoulSeconds = seoulSecondsSinceMidnight(referenceAt);
  const currentMinute = Math.floor(seoulSeconds / 60);
  const matches = timetable.filter((slot) =>
    isMinuteInRange(currentMinute, slot.startTime, slot.endTime),
  );
  const current = matches.length === 1 ? matches[0] : undefined;
  const isOvernight =
    currentMinute >= OVERNIGHT_START_MINUTE ||
    currentMinute < OVERNIGHT_END_MINUTE;

  if (isOvernight) {
    return {
      canMemberStart: true,
      current,
      kind: "OVERNIGHT",
      seoulSeconds,
    };
  }
  if (!timetableLoaded) {
    return {
      canMemberStart: false,
      current,
      kind: "UNKNOWN",
      seoulSeconds,
    };
  }
  if (!current) {
    return {
      canMemberStart: false,
      current,
      kind: "UNAVAILABLE",
      seoulSeconds,
    };
  }
  if (current.slot <= 0) {
    return {
      canMemberStart: false,
      current,
      kind: "SLOT0",
      seoulSeconds,
    };
  }

  return {
    canMemberStart: true,
    current,
    kind: current.isBreak ? "REGULAR_BREAK" : "REGULAR_STUDY",
    seoulSeconds,
  };
}

export function createStudyRecordingView({
  cameraPausedForBreak,
  loading,
  status,
  window,
}: {
  cameraPausedForBreak: boolean;
  loading: boolean;
  status: StudyTimeStatus | null;
  window: StudyRecordingWindow;
}): StudyRecordingView {
  if (!status?.active || !status.state || !status.source) {
    return {
      action: null,
      actionLabel: null,
      detail: loading
        ? "서버 기록을 연결하고 있습니다."
        : status?.active === false
          ? "카메라 연결 후 현재 시간의 공부 기록 상태를 확인합니다."
          : "서버의 현재 공부 기록 연결을 기다리고 있습니다.",
      label: loading
        ? "공부 상태 연결 중"
        : status?.active === false
          ? "카메라 등록 대기"
          : "공부 기록 연결 대기",
      tone: "syncing",
    };
  }

  if (status.source === "ADMIN") {
    return {
      action: null,
      actionLabel: null,
      detail: "관리자가 설정한 공부 상태입니다.",
      label: status.state === "STUDY" ? "관리자 설정 공부" : "관리자 설정 휴식",
      tone: "system",
    };
  }

  if (
    cameraPausedForBreak ||
    (status.state === "BREAK" && status.source === "MEMBER")
  ) {
    return window.canMemberStart
      ? {
          action: "RESUME",
          actionLabel: "계속 공부하기",
          detail:
            "카메라와 공부시간 기록이 멈춰 있습니다. 돌아오면 계속 공부하기를 눌러주세요.",
          label: "휴식 중",
          tone: "break",
        }
      : {
          action: null,
          actionLabel: null,
          detail:
            "현재는 공부를 시작할 수 없는 시간입니다. 카메라는 계속 꺼져 있습니다.",
          label: "휴식 중",
          tone: "break",
        };
  }

  if (status.source === "SYSTEM") {
    return {
      action: null,
      actionLabel: null,
      detail: "카메라 연결을 복구한 뒤 공부 상태를 다시 확인해 주세요.",
      label: "카메라 확인 필요",
      tone: "system",
    };
  }

  if (status.state === "STUDY") {
    const startedAt = studyStateStartedAt(status.stateStartedAt);
    const label =
      window.kind === "OVERNIGHT"
        ? "야간 자율학습 중"
        : window.kind === "REGULAR_BREAK"
          ? "휴식시간 공부 중"
          : "공부 중";

    return {
      action: "BREAK",
      actionLabel: "기록중지",
      detail: startedAt
        ? `${startedAt} 실제 공부시간에 포함되고 있습니다.`
        : "실제 공부시간에 포함되고 있습니다.",
      label,
      tone: "study",
    };
  }

  if (status.state === "BREAK" && status.source === "SCHEDULE") {
    if (window.kind === "REGULAR_BREAK") {
      return {
        action: "RESUME",
        actionLabel: "공부 시작",
        detail:
          "공부시간 기록은 자동으로 쉬고 있으며 카메라는 계속 켜져 있습니다.",
        label: "정규 휴식",
        tone: "schedule",
      };
    }
    if (window.kind === "OVERNIGHT") {
      return {
        action: "RESUME",
        actionLabel: "공부 시작",
        detail:
          "카메라는 켜져 있습니다. 공부 시작을 누르면 야간 공부시간 기록을 시작합니다.",
        label: "야간 자율학습",
        tone: "schedule",
      };
    }
    if (window.kind === "REGULAR_STUDY") {
      return {
        action: null,
        actionLabel: null,
        detail: "서버의 정규 공부 전환을 확인하고 있습니다.",
        label: "공부 상태 전환 중",
        tone: "syncing",
      };
    }

    return {
      action: null,
      actionLabel: null,
      detail:
        window.kind === "UNKNOWN"
          ? "시간표를 확인한 뒤 공부 시작 가능 여부를 다시 안내합니다."
          : "현재는 공부시간 기록을 시작할 수 없습니다. 카메라는 계속 켜져 있습니다.",
      label: window.kind === "UNKNOWN" ? "시간표 확인 필요" : "공부 기록 대기",
      tone: "schedule",
    };
  }

  return {
    action: null,
    actionLabel: null,
    detail: "서버의 현재 공부 기록 상태를 다시 확인해 주세요.",
    label: "공부 상태 확인 필요",
    tone: "syncing",
  };
}
