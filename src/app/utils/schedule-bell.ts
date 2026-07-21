const SCHEDULE_SOUND_KEY = "jagong.schedule-sound";
const SCHEDULE_CHIME_SRC = "/audio/schedule-chime.mp3";

export type ScheduleBellEvent = {
  type: string;
  label?: string;
  messages?: string[];
};

let audioContext: AudioContext | null = null;
let scheduleChime: HTMLAudioElement | null = null;
let scheduledChimeTimers: number[] = [];
const activeScheduleChimes = new Set<HTMLAudioElement>();

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || !window.AudioContext) return null;
  audioContext ??= new window.AudioContext();
  return audioContext;
}

function getScheduleChime(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  scheduleChime ??= new Audio(SCHEDULE_CHIME_SRC);
  scheduleChime.preload = "auto";
  scheduleChime.volume = 0.85;
  return scheduleChime;
}

function stopScheduleChimes(): void {
  scheduledChimeTimers.forEach((timer) => window.clearTimeout(timer));
  scheduledChimeTimers = [];
  activeScheduleChimes.forEach((chime) => chime.pause());
  activeScheduleChimes.clear();
}

function playScheduleChime(delayMs = 0): void {
  const source = getScheduleChime();
  if (!source) return;

  [0, 550].forEach((offsetMs) => {
    const timer = window.setTimeout(() => {
      scheduledChimeTimers = scheduledChimeTimers.filter(
        (item) => item !== timer,
      );
      const chime = source.cloneNode(true) as HTMLAudioElement;
      chime.volume = source.volume;
      activeScheduleChimes.add(chime);
      chime.addEventListener(
        "ended",
        () => activeScheduleChimes.delete(chime),
        { once: true },
      );
      void chime.play().catch(() => activeScheduleChimes.delete(chime));
    }, delayMs + offsetMs);
    scheduledChimeTimers.push(timer);
  });
}

function playNote(
  context: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.075, startAt + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

export function getScheduleSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SCHEDULE_SOUND_KEY) === "true";
  } catch {
    return false;
  }
}

export async function setScheduleSoundEnabled(enabled: boolean): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(SCHEDULE_SOUND_KEY, String(enabled));
  } catch {
    return false;
  }
  if (!enabled) {
    stopScheduleChimes();
    return true;
  }

  const context = getAudioContext();
  if (!context) return false;

  try {
    await context.resume();
    getScheduleChime()?.load();
    return context.state === "running";
  } catch {
    return false;
  }
}

export function playScheduleTone(type: string): void {
  const context = audioContext;
  if (!context || context.state !== "running") return;

  const now = context.currentTime + 0.02;
  if (type === "preview") {
    playNote(context, 659, now, 0.3);
    playScheduleChime(750);
    return;
  }

  if (type === "breakStart" || type === "periodStart") {
    playScheduleChime();
    return;
  }

  playNote(context, 659, now, 0.3);
}

export function scheduleBellMessage(event: ScheduleBellEvent): string {
  if (event.type === "countdown") {
    return `1분 뒤 ${event.label ?? "다음 교시"}이 시작됩니다. 카메라와 자리를 확인해 주세요.`;
  }

  if (event.type === "periodStart") {
    return `${event.label ?? "교시"}이 시작되었습니다. 카메라와 자리를 확인해 주세요.`;
  }

  if (event.type === "breakStart") {
    return `지금은 ${event.label ?? "쉬는시간"}입니다. ${event.messages?.[0] ?? "다음 교시 전까지 편하게 쉬세요."}`;
  }

  return "";
}
