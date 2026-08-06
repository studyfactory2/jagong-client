export type MemberAlertSound = "notification" | "warning";

type PendingAlert = {
  id: string;
  sessionVersion: number;
  sound: MemberAlertSound;
};

type AlertNote = {
  frequency: number;
  offset: number;
  duration: number;
  gain: number;
  oscillator: OscillatorType;
};

const ALERT_CLAIM_PREFIX = "jagong.member-alert.";
const ALERT_CLAIM_TTL_MS = 60_000;

let alertAudioContext: AudioContext | null = null;
let pendingAlert: PendingAlert | null = null;
let alertSessionVersion = 0;
const playedInThisTab = new Map<string, number>();

function getAlertAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || !window.AudioContext) return null;
  if (!alertAudioContext || alertAudioContext.state === "closed") {
    alertAudioContext = new window.AudioContext();
  }
  return alertAudioContext;
}

async function resumeAlertAudio(): Promise<AudioContext | null> {
  const context = getAlertAudioContext();
  if (!context) return null;

  try {
    if (context.state !== "running") await context.resume();
    return context.state === "running" ? context : null;
  } catch {
    return null;
  }
}

function claimStoredAlert(claimId: string, now: number): boolean {
  if (playedInThisTab.has(claimId)) return false;

  if (typeof window !== "undefined") {
    try {
      const storageKey = ALERT_CLAIM_PREFIX + claimId;
      const storedAt = Number(window.localStorage.getItem(storageKey));
      if (Number.isFinite(storedAt) && now - storedAt < ALERT_CLAIM_TTL_MS) {
        playedInThisTab.set(claimId, storedAt);
        return false;
      }
      window.localStorage.setItem(storageKey, String(now));
      window.setTimeout(() => {
        try {
          if (window.localStorage.getItem(storageKey) === String(now)) {
            window.localStorage.removeItem(storageKey);
          }
        } catch {
          // In-memory deduplication still applies when storage is unavailable.
        }
      }, ALERT_CLAIM_TTL_MS);
    } catch {
      // Private browsing or storage policy can make localStorage unavailable.
    }
  }

  playedInThisTab.set(claimId, now);
  return true;
}

async function claimAlert(alert: PendingAlert): Promise<boolean> {
  const now = Date.now();
  const claimId = `${alert.sound}:${alert.id}`;

  playedInThisTab.forEach((playedAt, id) => {
    if (now - playedAt >= ALERT_CLAIM_TTL_MS) playedInThisTab.delete(id);
  });
  if (typeof navigator !== "undefined" && navigator.locks) {
    try {
      return await navigator.locks.request(
        ALERT_CLAIM_PREFIX + claimId,
        () => claimStoredAlert(claimId, now),
      );
    } catch {
      // Fall back when the browser exposes Web Locks but cannot acquire one.
    }
  }

  // The storage fallback is best-effort in browsers without Web Locks.
  return claimStoredAlert(claimId, now);
}

function playNote(context: AudioContext, note: AlertNote, startsAt: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const noteStartsAt = startsAt + note.offset;
  const noteEndsAt = noteStartsAt + note.duration;

  oscillator.type = note.oscillator;
  oscillator.frequency.setValueAtTime(note.frequency, noteStartsAt);
  gain.gain.setValueAtTime(0.0001, noteStartsAt);
  gain.gain.exponentialRampToValueAtTime(note.gain, noteStartsAt + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, noteEndsAt);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.addEventListener(
    "ended",
    () => {
      oscillator.disconnect();
      gain.disconnect();
    },
    { once: true },
  );
  oscillator.start(noteStartsAt);
  oscillator.stop(noteEndsAt + 0.02);
}

function playAlert(context: AudioContext, sound: MemberAlertSound): void {
  const notificationNotes: AlertNote[] = [
    {
      frequency: 659.25,
      offset: 0,
      duration: 0.2,
      gain: 0.075,
      oscillator: "sine",
    },
    {
      frequency: 783.99,
      offset: 0.16,
      duration: 0.34,
      gain: 0.09,
      oscillator: "sine",
    },
  ];
  const warningNotes: AlertNote[] = [
    {
      frequency: 880,
      offset: 0,
      duration: 0.18,
      gain: 0.12,
      oscillator: "triangle",
    },
    {
      frequency: 659.25,
      offset: 0.22,
      duration: 0.2,
      gain: 0.13,
      oscillator: "triangle",
    },
    {
      frequency: 880,
      offset: 0.52,
      duration: 0.18,
      gain: 0.12,
      oscillator: "triangle",
    },
    {
      frequency: 659.25,
      offset: 0.74,
      duration: 0.24,
      gain: 0.13,
      oscillator: "triangle",
    },
  ];
  const startsAt = context.currentTime + 0.02;
  const notes = sound === "warning" ? warningNotes : notificationNotes;
  notes.forEach((note) => playNote(context, note, startsAt));
}

async function playClaimedAlert(
  context: AudioContext,
  alert: PendingAlert,
): Promise<void> {
  const claimed = await claimAlert(alert);
  if (!claimed || alert.sessionVersion !== alertSessionVersion) return;
  playAlert(context, alert.sound);
}

function playPendingAlert(context: AudioContext): void {
  const alert = pendingAlert;
  pendingAlert = null;
  if (alert) void playClaimedAlert(context, alert);
}

export function armMemberAlertSound(): () => void {
  if (typeof window === "undefined") return () => {};

  let active = true;
  const removeUnlockListeners = () => {
    window.removeEventListener("pointerdown", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
  };
  const unlockAudio = () => {
    void resumeAlertAudio().then((context) => {
      if (!active || !context) return;
      playPendingAlert(context);
    });
  };

  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio);

  return () => {
    active = false;
    removeUnlockListeners();
  };
}

export function playMemberAlertSound(
  sound: MemberAlertSound,
  alertId: string,
): void {
  const id = alertId.trim();
  if (!id || typeof window === "undefined") return;

  const alert = { id, sessionVersion: alertSessionVersion, sound };
  void resumeAlertAudio().then((context) => {
    if (!context) {
      if (!pendingAlert || sound === "warning") pendingAlert = alert;
      return;
    }
    void playClaimedAlert(context, alert);
  });
}

export function clearPendingMemberAlertSound(): void {
  pendingAlert = null;
  alertSessionVersion += 1;
}
