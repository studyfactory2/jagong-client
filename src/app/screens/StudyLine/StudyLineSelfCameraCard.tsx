import VideocamOffRoundedIcon from "@mui/icons-material/VideocamOffRounded";
import { useEffect, useRef } from "react";
import type { LocalVideoTrack } from "livekit-client";

type StudyLineSelfCameraCardProps = {
  cameraPausedForBreak: boolean;
  memberName: string;
  stateLabel: string;
  todayStudySeconds?: number;
  track: LocalVideoTrack | null;
};

function formatTodayStudyTime(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return "--:--:--";

  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;

  return [hours, minutes, remainder]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export default function StudyLineSelfCameraCard({
  cameraPausedForBreak,
  memberName,
  stateLabel,
  todayStudySeconds,
  track,
}: StudyLineSelfCameraCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVisible = Boolean(
    track && !cameraPausedForBreak && !track.isMuted,
  );

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !track || !cameraVisible) return undefined;

    track.attach(element);
    void element.play().catch(() => undefined);

    return () => {
      track.detach(element);
    };
  }, [cameraVisible, track]);

  const cameraStateLabel = cameraPausedForBreak
    ? "휴식 중"
    : cameraVisible
      ? stateLabel
      : "연결 확인";
  const todayStudyTime = formatTodayStudyTime(todayStudySeconds);

  return (
    <section
      aria-label={`${memberName}님의 카메라`}
      className={`sl-self-camera${cameraVisible ? " is-live" : " is-paused"}`}
    >
      <div className="sl-self-camera__frame">
        {cameraVisible ? (
          <video ref={videoRef} autoPlay muted playsInline />
        ) : (
          <div className="sl-self-camera__placeholder">
            <VideocamOffRoundedIcon />
            <strong>
              {cameraPausedForBreak
                ? "휴식 중에는 카메라가 꺼집니다."
                : "카메라 화면을 연결하고 있습니다."}
            </strong>
          </div>
        )}

        <span
          aria-label={`오늘 공부시간 ${todayStudyTime}`}
          className="sl-self-camera__today-study"
          title={`오늘 공부시간 ${todayStudyTime}`}
        >
          <small>오늘</small>
          <strong>{todayStudyTime}</strong>
        </span>

        <div className="sl-self-camera__meta">
          <span>{memberName}</span>
          <em>{cameraStateLabel}</em>
        </div>
      </div>
    </section>
  );
}
