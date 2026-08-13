import VideocamOffRoundedIcon from "@mui/icons-material/VideocamOffRounded";
import { useEffect, useRef } from "react";
import type { LocalVideoTrack } from "livekit-client";

type StudyLineSelfCameraCardProps = {
  cameraPausedForBreak: boolean;
  memberName: string;
  track: LocalVideoTrack | null;
};

export default function StudyLineSelfCameraCard({
  cameraPausedForBreak,
  memberName,
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

  return (
    <section aria-label={`${memberName}님의 카메라`} className="sl-self-camera">
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
      </div>
    </section>
  );
}
