import type { WorkdayAnnouncement } from "./schedule-bell";

const SEOUL_TIME_ZONE = "Asia/Seoul";
const MORNING_RESET_HOUR = 6;
const REGULAR_START_HOUR = 9;
const OVERNIGHT_START_HOUR = 22;
const CLAIM_STORAGE_PREFIX = "jagong.workday-announcement-claims.v2";
const LEGACY_CLAIM_STORAGE_PREFIX = "jagong.workday-announcement-claims.v1";
const CLAIM_STORAGE_VERSION = 2;
const CLAIM_LEDGER_RETENTION_DAYS = 45;
const CLAIM_RESERVATION_TTL_MS = 15_000;
const NO_LOCK_SETTLE_MS = 50;
const MAX_ANNOUNCEMENT_ID_LENGTH = 64;
const ACTION_INTENT_TTL_MS = 60 * 60 * 1000;
const INTENT_CLOCK_TOLERANCE_MS = 60_000;
const INTENT_STATE_KEY = "workroomAnnouncementIntent";
const ANNOUNCEMENT_ID_PATTERN =
  /^schedule:(\d{4}-\d{2}-\d{2}):workday-(start|end)$/;

export const WORKDAY_ANNOUNCEMENT_RESERVATION_RETRY_MS =
  CLAIM_RESERVATION_TTL_MS + 100;

const seoulClockFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SEOUL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const committedRuntimeClaims = new Set<string>();
const runtimeReservations = new Map<
  string,
  { token: string; leaseUntil: number }
>();
const pendingReservations = new Map<string, Promise<string | null>>();
let claimGenerationEpoch = 0;

type SeoulClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type ClaimPurpose = "display" | "sound";
type ClaimSlot = "start.display" | "start.sound" | "end.display" | "end.sound";

type ClaimReservation = {
  state: "reserved";
  token: string;
  leaseUntil: number;
};

type ClaimCommit = {
  state: "committed";
  token: string | null;
};

type ClaimLedger = {
  v: 2;
  day: string;
  claims: Partial<Record<ClaimSlot, ClaimCommit | ClaimReservation>>;
};

type ParsedAnnouncementId = {
  day: string;
  phase: "start" | "end";
};

export type WorkroomAnnouncementIntentKind =
  | "START_STUDY"
  | "CONTINUE_OVERNIGHT";

export type WorkroomAnnouncementIntent = {
  version: 1;
  announcementId: string;
  kind: WorkroomAnnouncementIntentKind;
  requestedAt: string;
  expiresAt: string;
};

export type WorkroomAnnouncementPresentation = {
  announcement: WorkdayAnnouncement;
  badgeLabel: string;
  primaryLabel: string;
  intentKind: WorkroomAnnouncementIntentKind;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function seoulClock(referenceAt: Date): SeoulClock {
  const values: Partial<SeoulClock> = {};
  seoulClockFormatter.formatToParts(referenceAt).forEach((part) => {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day" ||
      part.type === "hour" ||
      part.type === "minute" ||
      part.type === "second"
    ) {
      values[part.type] = Number(part.value);
    }
  });

  return {
    year: values.year ?? 1970,
    month: values.month ?? 1,
    day: values.day ?? 1,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

function dateOnly(clock: Pick<SeoulClock, "year" | "month" | "day">): string {
  return `${String(clock.year).padStart(4, "0")}-${String(clock.month).padStart(2, "0")}-${String(clock.day).padStart(2, "0")}`;
}

function addUtcDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return dateOnly({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

function seoulBoundary(date: string, hour: number): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 9));
}

function announcementDay(referenceAt: Date): {
  date: string;
  clock: SeoulClock;
} {
  const clock = seoulClock(referenceAt);
  const currentDate = dateOnly(clock);
  return {
    date:
      clock.hour < MORNING_RESET_HOUR
        ? addUtcDays(currentDate, -1)
        : currentDate,
    clock,
  };
}

function morningAnnouncement(
  date: string,
  beforeRegularStart: boolean,
): WorkroomAnnouncementPresentation {
  return {
    announcement: {
      id: `schedule:${date}:workday-start`,
      kind: "WORKDAY_START",
      title: "공장 출근 성공을 축하합니다!",
      body: [
        "매일 같은 노력을 정확하게 반복하는 자가 운명을 뚫는 막대한 힘을 가집니다.",
        "우리 오늘도 화이팅 해요🙋‍♀️",
      ],
      note: beforeRegularStart
        ? "정규 일정은 오전 9시에 시작됩니다. 지금 시작하면 자율 공부시간으로 기록됩니다."
        : "카메라를 확인하고 입장하면 공부시간 기록이 자동으로 시작됩니다.",
    },
    badgeLabel: "오늘의 시작",
    primaryLabel: beforeRegularStart
      ? "카메라 확인하고 자율 공부 시작"
      : "카메라 확인하고 공부 시작",
    intentKind: "START_STUDY",
  };
}

function overnightAnnouncement(date: string): WorkroomAnnouncementPresentation {
  return {
    announcement: {
      id: `schedule:${date}:workday-end`,
      kind: "WORKDAY_END",
      title: "야간 자율 공부를 시작할까요?",
      body: [
        "정규 일정이 끝난 시간입니다.",
        "계속 공부하면 실제 야간 공부시간으로 기록됩니다.",
      ],
      note: "카메라를 확인하고 입장한 뒤 공부 기록이 시작됩니다.",
    },
    badgeLabel: "야간",
    primaryLabel: "야간 자율 공부 시작",
    intentKind: "CONTINUE_OVERNIGHT",
  };
}

export function resolveFreshEntryAnnouncement(
  referenceAt: Date = new Date(),
): WorkroomAnnouncementPresentation {
  const { date, clock } = announcementDay(referenceAt);
  const isMorningWindow =
    clock.hour >= MORNING_RESET_HOUR && clock.hour < OVERNIGHT_START_HOUR;

  return isMorningWindow
    ? morningAnnouncement(date, clock.hour < REGULAR_START_HOUR)
    : overnightAnnouncement(date);
}

export function presentLiveWorkdayAnnouncement(
  announcement: WorkdayAnnouncement,
): WorkroomAnnouncementPresentation {
  if (announcement.kind === "WORKDAY_START") {
    return {
      announcement,
      badgeLabel: "09:00",
      primaryLabel: "카메라 확인하고 공부 시작",
      intentKind: "START_STUDY",
    };
  }

  return {
    announcement,
    badgeLabel: "22:00",
    primaryLabel: "계속 공부하기",
    intentKind: "CONTINUE_OVERNIGHT",
  };
}

// This keeps raw user IDs out of browser storage keys. It is a stable
// pseudonymous identifier, not encryption or an authorization boundary.
export function workdayAnnouncementOwnerFingerprint(userId: string): string {
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < userId.length; index += 1) {
    const value = userId.charCodeAt(index);
    first = Math.imul(first ^ value, 16777619);
    second = Math.imul(second ^ value, 3266489917);
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
}

function claimStorageKey(userId: string): string {
  return `${CLAIM_STORAGE_PREFIX}:${workdayAnnouncementOwnerFingerprint(userId)}`;
}

function legacyClaimStorageKey(userId: string): string {
  return `${LEGACY_CLAIM_STORAGE_PREFIX}:${userId}`;
}

export function clearObsoleteWorkdayAnnouncementClaims(): void {
  try {
    const staleEntries: Array<{ key: string; observedRaw: string | null }> = [];
    const oldestRetainedDay = addUtcDays(
      announcementDay(new Date()).date,
      -CLAIM_LEDGER_RETENTION_DAYS,
    );
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      if (key.startsWith(`${LEGACY_CLAIM_STORAGE_PREFIX}:`)) {
        staleEntries.push({
          key,
          observedRaw: window.localStorage.getItem(key),
        });
        continue;
      }
      if (!key.startsWith(`${CLAIM_STORAGE_PREFIX}:`)) continue;

      const observedRaw = window.localStorage.getItem(key);
      try {
        const stored = asRecord(JSON.parse(observedRaw ?? ""));
        if (
          stored?.v !== CLAIM_STORAGE_VERSION ||
          typeof stored.day !== "string" ||
          addUtcDays(stored.day, 0) !== stored.day ||
          stored.day < oldestRetainedDay
        ) {
          staleEntries.push({ key, observedRaw });
        }
      } catch {
        staleEntries.push({ key, observedRaw });
      }
    }
    staleEntries.forEach(({ key, observedRaw }) => {
      if (window.localStorage.getItem(key) === observedRaw) {
        window.localStorage.removeItem(key);
      }
    });
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}

function parseAnnouncementId(announcementId: string): ParsedAnnouncementId | null {
  if (
    !announcementId ||
    announcementId.length > MAX_ANNOUNCEMENT_ID_LENGTH
  ) {
    return null;
  }

  const match = announcementId.match(ANNOUNCEMENT_ID_PATTERN);
  if (!match) return null;
  const [, day, phase] = match;
  if (addUtcDays(day, 0) !== day) return null;
  return { day, phase: phase as ParsedAnnouncementId["phase"] };
}

function claimSlot(
  parsed: ParsedAnnouncementId,
  purpose: ClaimPurpose,
): ClaimSlot {
  return `${parsed.phase}.${purpose}`;
}

function claimRuntimeKey(
  userId: string,
  parsed: ParsedAnnouncementId,
  purpose: ClaimPurpose,
): string {
  return `${userId}:${parsed.day}:${claimSlot(parsed, purpose)}`;
}

function claimGeneration(): number {
  return claimGenerationEpoch;
}

function isCurrentGeneration(generation: number): boolean {
  return claimGeneration() === generation;
}

function isClaimSlot(value: string): value is ClaimSlot {
  return (
    value === "start.display" ||
    value === "start.sound" ||
    value === "end.display" ||
    value === "end.sound"
  );
}

function readClaimLedger(
  userId: string,
  expectedDay: string,
  now: number,
): ClaimLedger | null {
  try {
    window.localStorage.removeItem(legacyClaimStorageKey(userId));
    const raw = window.localStorage.getItem(claimStorageKey(userId));
    if (!raw) {
      return { v: CLAIM_STORAGE_VERSION, day: expectedDay, claims: {} };
    }

    const parsed = asRecord(JSON.parse(raw));
    if (
      parsed?.v !== CLAIM_STORAGE_VERSION ||
      typeof parsed.day !== "string" ||
      addUtcDays(parsed.day, 0) !== parsed.day
    ) {
      return { v: CLAIM_STORAGE_VERSION, day: expectedDay, claims: {} };
    }

    if (parsed.day > expectedDay) return null;
    if (parsed.day < expectedDay) {
      return { v: CLAIM_STORAGE_VERSION, day: expectedDay, claims: {} };
    }

    const claims: ClaimLedger["claims"] = {};
    const storedClaims = asRecord(parsed.claims);
    Object.entries(storedClaims ?? {}).forEach(([slot, value]) => {
      if (!isClaimSlot(slot)) return;
      if (value === "committed") {
        claims[slot] = { state: "committed", token: null };
        return;
      }

      const reservation = asRecord(value);
      if (
        reservation?.state === "committed" &&
        typeof reservation.token === "string" &&
        reservation.token.length > 0 &&
        reservation.token.length <= 128
      ) {
        claims[slot] = { state: "committed", token: reservation.token };
        return;
      }
      if (
        reservation?.state === "reserved" &&
        typeof reservation.token === "string" &&
        reservation.token.length > 0 &&
        reservation.token.length <= 128 &&
        typeof reservation.leaseUntil === "number" &&
        Number.isFinite(reservation.leaseUntil) &&
        reservation.leaseUntil > now
      ) {
        claims[slot] = {
          state: "reserved",
          token: reservation.token,
          leaseUntil: reservation.leaseUntil,
        };
      }
    });

    return { v: CLAIM_STORAGE_VERSION, day: expectedDay, claims };
  } catch {
    return null;
  }
}

function writeClaimLedger(userId: string, ledger: ClaimLedger): boolean {
  try {
    window.localStorage.setItem(claimStorageKey(userId), JSON.stringify(ledger));
    return true;
  } catch {
    return false;
  }
}

function reservationToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const values = new Uint32Array(4);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(values);
    return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join(
      "",
    );
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function reserveDisplayInStorage(
  userId: string,
  parsed: ParsedAnnouncementId,
  generation: number,
): string | "claimed" | null {
  if (!isCurrentGeneration(generation)) return null;

  const runtimeKey = claimRuntimeKey(userId, parsed, "display");
  if (committedRuntimeClaims.has(runtimeKey)) return "claimed";

  const now = Date.now();
  const ledger = readClaimLedger(userId, parsed.day, now);
  if (!ledger || !isCurrentGeneration(generation)) return null;
  const slot = claimSlot(parsed, "display");
  const stored = ledger.claims[slot];
  if (stored?.state === "committed") {
    committedRuntimeClaims.add(runtimeKey);
    return "claimed";
  }
  if (stored) return null;

  const token = reservationToken();
  const leaseUntil = now + CLAIM_RESERVATION_TTL_MS;
  ledger.claims[slot] = { state: "reserved", token, leaseUntil };
  if (
    !isCurrentGeneration(generation) ||
    !writeClaimLedger(userId, ledger)
  ) {
    return null;
  }

  runtimeReservations.set(runtimeKey, { token, leaseUntil });
  return token;
}

async function reserveDisplayWithoutLocks(
  userId: string,
  parsed: ParsedAnnouncementId,
  generation: number,
): Promise<string | "claimed" | null> {
  const result = reserveDisplayInStorage(userId, parsed, generation);
  if (!result || result === "claimed") return result;

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, NO_LOCK_SETTLE_MS);
  });
  if (!isCurrentGeneration(generation)) return null;

  const ledger = readClaimLedger(userId, parsed.day, Date.now());
  const stored = ledger?.claims[claimSlot(parsed, "display")];
  if (
    stored?.state === "committed" ||
    !stored ||
    stored.token !== result
  ) {
    runtimeReservations.delete(claimRuntimeKey(userId, parsed, "display"));
    return stored?.state === "committed" ? "claimed" : null;
  }
  return result;
}

async function withClaimLock<T>(
  userId: string,
  operation: () => T | Promise<T>,
  withoutLocks: () => T | Promise<T>,
): Promise<T | null> {
  if (typeof navigator === "undefined" || !navigator.locks) {
    return await withoutLocks();
  }

  try {
    return await navigator.locks.request(
      `${CLAIM_STORAGE_PREFIX}:lock:${workdayAnnouncementOwnerFingerprint(userId)}`,
      operation,
    );
  } catch {
    return null;
  }
}

export type WorkdayAnnouncementDisplayReservation = {
  announcementId: string;
  generation: number;
  token: string;
};

export type WorkdayAnnouncementDisplayClaim =
  | { status: "reserved"; reservation: WorkdayAnnouncementDisplayReservation }
  | { status: "claimed" };

export function reserveWorkdayAnnouncementDisplay(
  userId: string,
  announcementId: string,
): Promise<WorkdayAnnouncementDisplayClaim | null> {
  const parsed = parseAnnouncementId(announcementId);
  if (!userId || !parsed) return Promise.resolve(null);
  const runtimeKey = claimRuntimeKey(userId, parsed, "display");
  const pending = pendingReservations.get(runtimeKey);
  if (pending) {
    return pending.then((token) =>
      token
        ? {
            status: "reserved" as const,
            reservation: {
              announcementId,
              generation: claimGeneration(),
              token,
            },
          }
        : committedRuntimeClaims.has(runtimeKey)
          ? { status: "claimed" as const }
          : null,
    );
  }

  const generation = claimGeneration();
  const pendingReservation = withClaimLock(
    userId,
    () => reserveDisplayInStorage(userId, parsed, generation),
    () => reserveDisplayWithoutLocks(userId, parsed, generation),
  ).then((result) => {
    if (result === "claimed") {
      committedRuntimeClaims.add(runtimeKey);
      return null;
    }
    return result;
  });

  pendingReservations.set(runtimeKey, pendingReservation);
  return pendingReservation
    .then((token): WorkdayAnnouncementDisplayClaim | null => {
      if (token) {
        return {
          status: "reserved",
          reservation: { announcementId, generation, token },
        };
      }
      return committedRuntimeClaims.has(runtimeKey)
        ? { status: "claimed" }
        : null;
    })
    .finally(() => {
      if (pendingReservations.get(runtimeKey) === pendingReservation) {
        pendingReservations.delete(runtimeKey);
      }
    });
}

export function isWorkdayAnnouncementDisplayReservationCurrent(
  userId: string,
  reservation: WorkdayAnnouncementDisplayReservation,
): boolean {
  const parsed = parseAnnouncementId(reservation.announcementId);
  if (!userId || !parsed || !isCurrentGeneration(reservation.generation)) {
    return false;
  }
  const runtimeReservation = runtimeReservations.get(
    claimRuntimeKey(userId, parsed, "display"),
  );
  return runtimeReservation?.token === reservation.token;
}

function changeDisplayReservation(
  userId: string,
  reservation: WorkdayAnnouncementDisplayReservation,
  commit: boolean,
): boolean {
  const parsed = parseAnnouncementId(reservation.announcementId);
  if (!userId || !parsed) return false;
  const runtimeKey = claimRuntimeKey(userId, parsed, "display");
  if (commit && !isCurrentGeneration(reservation.generation)) return false;
  const ledger = readClaimLedger(userId, parsed.day, Date.now());
  if (!ledger) return false;

  const slot = claimSlot(parsed, "display");
  const stored = ledger.claims[slot];
  if (!stored) return false;
  if (stored.state === "committed") {
    return commit && stored.token === reservation.token;
  }
  if (stored.token !== reservation.token) return false;

  if (commit) {
    ledger.claims[slot] = {
      state: "committed",
      token: reservation.token,
    };
  } else {
    delete ledger.claims[slot];
  }
  if (
    (commit && !isCurrentGeneration(reservation.generation)) ||
    !writeClaimLedger(userId, ledger)
  ) {
    return false;
  }

  runtimeReservations.delete(runtimeKey);
  if (commit) committedRuntimeClaims.add(runtimeKey);
  return true;
}

export async function commitWorkdayAnnouncementDisplay(
  userId: string,
  reservation: WorkdayAnnouncementDisplayReservation,
): Promise<boolean> {
  const result = await withClaimLock(
    userId,
    () => changeDisplayReservation(userId, reservation, true),
    () => changeDisplayReservation(userId, reservation, true),
  );
  return result === true;
}

export async function releaseWorkdayAnnouncementDisplay(
  userId: string,
  reservation: WorkdayAnnouncementDisplayReservation,
): Promise<void> {
  await withClaimLock(
    userId,
    () => changeDisplayReservation(userId, reservation, false),
    () => changeDisplayReservation(userId, reservation, false),
  );
}

function claimSoundInStorage(
  userId: string,
  parsed: ParsedAnnouncementId,
  generation: number,
): boolean {
  if (!isCurrentGeneration(generation)) return false;
  const runtimeKey = claimRuntimeKey(userId, parsed, "sound");
  if (committedRuntimeClaims.has(runtimeKey)) return false;

  const ledger = readClaimLedger(userId, parsed.day, Date.now());
  if (!ledger || !isCurrentGeneration(generation)) return false;
  const slot = claimSlot(parsed, "sound");
  if (ledger.claims[slot]) {
    if (ledger.claims[slot]?.state === "committed") {
      committedRuntimeClaims.add(runtimeKey);
    }
    return false;
  }

  ledger.claims[slot] = { state: "committed", token: reservationToken() };
  if (
    !isCurrentGeneration(generation) ||
    !writeClaimLedger(userId, ledger)
  ) {
    return false;
  }
  committedRuntimeClaims.add(runtimeKey);
  return true;
}

async function claimSoundWithoutLocks(
  userId: string,
  parsed: ParsedAnnouncementId,
  generation: number,
): Promise<boolean> {
  if (!isCurrentGeneration(generation)) return false;
  const runtimeKey = claimRuntimeKey(userId, parsed, "sound");
  if (committedRuntimeClaims.has(runtimeKey)) return false;

  const ledger = readClaimLedger(userId, parsed.day, Date.now());
  if (!ledger || !isCurrentGeneration(generation)) return false;
  const slot = claimSlot(parsed, "sound");
  if (ledger.claims[slot]) {
    if (ledger.claims[slot]?.state === "committed") {
      committedRuntimeClaims.add(runtimeKey);
    }
    return false;
  }

  const token = reservationToken();
  ledger.claims[slot] = {
    state: "reserved",
    token,
    leaseUntil: Date.now() + CLAIM_RESERVATION_TTL_MS,
  };
  if (
    !isCurrentGeneration(generation) ||
    !writeClaimLedger(userId, ledger)
  ) {
    return false;
  }

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, NO_LOCK_SETTLE_MS);
  });
  if (!isCurrentGeneration(generation)) return false;

  const confirmedLedger = readClaimLedger(userId, parsed.day, Date.now());
  const stored = confirmedLedger?.claims[slot];
  if (!confirmedLedger || !stored || stored.state === "committed") return false;
  if (stored.token !== token) return false;

  confirmedLedger.claims[slot] = { state: "committed", token };
  if (
    !isCurrentGeneration(generation) ||
    !writeClaimLedger(userId, confirmedLedger)
  ) {
    return false;
  }
  committedRuntimeClaims.add(runtimeKey);
  return true;
}

export async function claimWorkdayAnnouncementSound(
  userId: string,
  announcementId: string,
): Promise<boolean> {
  const parsed = parseAnnouncementId(announcementId);
  if (!userId || !parsed) return false;
  const generation = claimGeneration();
  const result = await withClaimLock(
    userId,
    () => claimSoundInStorage(userId, parsed, generation),
    () => claimSoundWithoutLocks(userId, parsed, generation),
  );
  return result === true;
}

export function clearWorkdayAnnouncementClaims(userId: string): void {
  if (!userId) return;
  claimGenerationEpoch += 1;
  const runtimePrefix = `${userId}:`;
  [...committedRuntimeClaims].forEach((key) => {
    if (key.startsWith(runtimePrefix)) committedRuntimeClaims.delete(key);
  });
  [...runtimeReservations.keys()].forEach((key) => {
    if (key.startsWith(runtimePrefix)) runtimeReservations.delete(key);
  });
  [...pendingReservations.keys()].forEach((key) => {
    if (key.startsWith(runtimePrefix)) pendingReservations.delete(key);
  });

  try {
    window.localStorage.removeItem(claimStorageKey(userId));
    window.localStorage.removeItem(legacyClaimStorageKey(userId));
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}

function intentExpiry(
  kind: WorkroomAnnouncementIntentKind,
  announcementId: string,
  referenceAt: Date,
): Date {
  const date =
    parseAnnouncementId(announcementId)?.day ?? announcementDay(referenceAt).date;
  const actionBoundary = referenceAt.getTime() + ACTION_INTENT_TTL_MS;
  if (kind === "START_STUDY") return new Date(actionBoundary);

  const overnightBoundary = seoulBoundary(
    addUtcDays(date, 1),
    REGULAR_START_HOUR,
  );
  return new Date(Math.min(overnightBoundary.getTime(), actionBoundary));
}

export function createWorkroomAnnouncementIntent(
  presentation: WorkroomAnnouncementPresentation,
  referenceAt: Date = new Date(),
): WorkroomAnnouncementIntent {
  return {
    version: 1,
    announcementId: presentation.announcement.id,
    kind: presentation.intentKind,
    requestedAt: referenceAt.toISOString(),
    expiresAt: intentExpiry(
      presentation.intentKind,
      presentation.announcement.id,
      referenceAt,
    ).toISOString(),
  };
}

export function readWorkroomAnnouncementIntent(
  state: unknown,
): WorkroomAnnouncementIntent | null {
  const candidate = asRecord(asRecord(state)?.[INTENT_STATE_KEY]);
  const candidateKeys = candidate ? Object.keys(candidate).sort() : [];
  if (
    candidateKeys.join(",") !==
      "announcementId,expiresAt,kind,requestedAt,version" ||
    candidate?.version !== 1 ||
    typeof candidate.announcementId !== "string" ||
    (candidate.kind !== "START_STUDY" &&
      candidate.kind !== "CONTINUE_OVERNIGHT") ||
    typeof candidate.requestedAt !== "string" ||
    typeof candidate.expiresAt !== "string" ||
    !parseAnnouncementId(candidate.announcementId)
  ) {
    return null;
  }

  const requestedAt = new Date(candidate.requestedAt);
  const expiresAt = new Date(candidate.expiresAt);
  if (
    !Number.isFinite(requestedAt.getTime()) ||
    !Number.isFinite(expiresAt.getTime()) ||
    requestedAt.toISOString() !== candidate.requestedAt ||
    expiresAt.toISOString() !== candidate.expiresAt ||
    requestedAt.getTime() > Date.now() + INTENT_CLOCK_TOLERANCE_MS
  ) {
    return null;
  }

  const expectedPresentation = resolveFreshEntryAnnouncement(requestedAt);
  const expectedIntent = createWorkroomAnnouncementIntent(
    expectedPresentation,
    requestedAt,
  );
  if (
    expectedIntent.announcementId !== candidate.announcementId ||
    expectedIntent.kind !== candidate.kind ||
    expectedIntent.expiresAt !== candidate.expiresAt
  ) {
    return null;
  }

  return {
    version: 1,
    announcementId: candidate.announcementId,
    kind: candidate.kind,
    requestedAt: candidate.requestedAt,
    expiresAt: candidate.expiresAt,
  };
}

export function hasWorkroomAnnouncementIntentState(state: unknown): boolean {
  const record = asRecord(state);
  return Boolean(
    record && Object.prototype.hasOwnProperty.call(record, INTENT_STATE_KEY),
  );
}

export function createWorkroomAnnouncementIntentState(
  intent: WorkroomAnnouncementIntent,
): Record<string, unknown> {
  return {
    [INTENT_STATE_KEY]: intent,
  };
}

export function workroomAnnouncementIntentState(
  state: unknown,
): Record<string, unknown> | null {
  const intent = readWorkroomAnnouncementIntent(state);
  return intent ? { [INTENT_STATE_KEY]: intent } : null;
}

export function withoutWorkroomAnnouncementIntent(
  state: unknown,
): Record<string, unknown> | null {
  const record = asRecord(state);
  if (!record) return null;
  const nextState = { ...record };
  delete nextState[INTENT_STATE_KEY];
  return Object.keys(nextState).length > 0 ? nextState : null;
}
