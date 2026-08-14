import VideocamOffRoundedIcon from "@mui/icons-material/VideocamOffRounded";
import { useEffect, useRef, useState } from "react";
import type { LocalVideoTrack } from "livekit-client";
import { observeAdaptiveCameraFit } from "../../utils/adaptive-camera-fit";

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
  const [peerViewPreview, setPeerViewPreview] = useState(false);
  const cameraVisible = Boolean(
    track && !cameraPausedForBreak && !track.isMuted,
  );

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !track || !cameraVisible) return undefined;

    track.attach(element);
    const stopObservingCameraFit = observeAdaptiveCameraFit(element);
    void element.play().catch(() => undefined);

    return () => {
      stopObservingCameraFit();
      track.detach(element);
    };
  }, [cameraVisible, track]);

  return (
    <section aria-label={`${memberName}님의 카메라`} className="sl-self-camera">
      <div className="sl-self-camera__frame">
        {cameraVisible ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={peerViewPreview ? "is-peer-view-preview" : undefined}
            />

            <button
              aria-label="다른 학습자 화면 미리보기"
              aria-pressed={peerViewPreview}
              className="sl-self-camera__peer-toggle"
              onClick={() => setPeerViewPreview((current) => !current)}
              type="button"
            >
              {peerViewPreview ? "단체작업장 화면 " : "개인작업실 화면"}
            </button>
          </>
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
