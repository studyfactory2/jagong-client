const SCHEDULE_SOUND_KEY = "jagong.schedule-sound";

export type ScheduleBellEvent = {
  type: string;
  label?: string;
  messages?: string[];
};

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || !window.AudioContext) return null;
  audioContext ??= new window.AudioContext();
  return audioContext;
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
  gain.gain.exponentialRampToValueAtTime(0.045, startAt + 0.025);
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
  if (!enabled) return true;

  const context = getAudioContext();
  if (!context) return false;

  try {
    await context.resume();
    return context.state === "running";
  } catch {
    return false;
  }
}

export function playScheduleTone(type: string): void {
  const context = audioContext;
  if (!context || context.state !== "running") return;

  const now = context.currentTime + 0.02;
  if (type === "breakStart") {
    playNote(context, 784, now, 0.22);
    playNote(context, 659, now + 0.26, 0.32);
    return;
  }

  if (type === "periodStart") {
    playNote(context, 784, now, 0.18);
    playNote(context, 988, now + 0.22, 0.32);
    return;
  }

  playNote(context, 659, now, 0.22);
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
