import { useEffect, useRef } from "react";
import BlurOnRoundedIcon from "@mui/icons-material/BlurOnRounded";
import DoorFrontOutlinedIcon from "@mui/icons-material/DoorFrontOutlined";
import FaceRetouchingNaturalRoundedIcon from "@mui/icons-material/FaceRetouchingNaturalRounded";
import FilterNoneRoundedIcon from "@mui/icons-material/FilterNoneRounded";
import {
  useWorkroomSession,
  type CameraEffect,
} from "../context/WorkroomSessionContext";
import "./workroom-camera-setup.css";

type WorkroomCameraSetupProps = {
  title: string;
  description: string;
  confirmLabel: string;
  busyLabel?: string;
  onConfirm: () => void | Promise<void>;
};

export default function WorkroomCameraSetup({
  title,
  description,
  confirmLabel,
  busyLabel = "카메라 확인 중...",
  onConfirm,
}: WorkroomCameraSetupProps) {
  const {
    joining,
    cameraReady,
    error,
    localVideoTrack,
    devices,
    selectedDeviceId,
    selectedEffect,
    effectSupport,
    effectLoading,
    effectError,
    previewCamera,
    selectCamera,
    selectCameraEffect,
  } = useWorkroomSession();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !localVideoTrack) return;

    localVideoTrack.attach(element);
    void element.play().catch(() => undefined);

    return () => {
      localVideoTrack.detach(element);
    };
  }, [localVideoTrack]);

  const handleEffectChange = async (effect: CameraEffect) => {
    await selectCameraEffect(effect);
  };

  return (
    <section className="workroom-camera-setup" aria-labelledby="camera-setup-title">
      <div className="workroom-camera-setup__video">
        <video ref={videoRef} muted playsInline />
        {!cameraReady && (
          <span>
            <DoorFrontOutlinedIcon />
            카메라 각도와 기기를 먼저 확인해 주세요.
          </span>
        )}
      </div>

      <div className="workroom-camera-setup__info">
        <strong id="camera-setup-title">{title}</strong>
        <em>{description}</em>

        <label>
          <span>카메라 선택</span>
          <select
            value={selectedDeviceId}
            onChange={(event) => void selectCamera(event.target.value)}
            disabled={joining || devices.length === 0}
          >
            {devices.length === 0 && (
              <option value="">미리보기 후 선택 가능</option>
            )}
            {devices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `카메라 ${index + 1}`}
              </option>
            ))}
          </select>
        </label>

        <div className="workroom-camera-setup__effects">
          <div className="workroom-camera-setup__effects-head">
            <span>화면 효과</span>
            <small>선택한 화면이 관리자에게도 동일하게 보입니다.</small>
          </div>

          <div
            className="workroom-camera-setup__effect-options"
            role="group"
            aria-label="카메라 화면 효과"
          >
            <button
              className={
                "workroom-camera-setup__effect-option" +
                (selectedEffect === "original" ? " is-selected" : "")
              }
              type="button"
              aria-pressed={selectedEffect === "original"}
              onClick={() => void handleEffectChange("original")}
              disabled={
                !cameraReady ||
                joining ||
                effectLoading ||
                (selectedEffect === "original" && !effectError)
              }
            >
              <span className="workroom-camera-setup__effect-icon is-original">
                <FilterNoneRoundedIcon />
              </span>
              <span className="workroom-camera-setup__effect-copy">
                <strong>원본</strong>
                <small>가공하지 않은 화면</small>
              </span>
            </button>

            <button
              className={
                "workroom-camera-setup__effect-option" +
                (selectedEffect === "background-blur" ? " is-selected" : "")
              }
              type="button"
              aria-pressed={selectedEffect === "background-blur"}
              onClick={() => void handleEffectChange("background-blur")}
              disabled={
                !cameraReady ||
                joining ||
                effectLoading ||
                effectSupport["background-blur"] === "unsupported" ||
                selectedEffect === "background-blur"
              }
            >
              <span className="workroom-camera-setup__effect-icon is-blur">
                <BlurOnRoundedIcon />
              </span>
              <span className="workroom-camera-setup__effect-copy">
                <strong>배경 흐림</strong>
                <small>주변 공간을 부드럽게</small>
              </span>
            </button>

            <button
              className={
                "workroom-camera-setup__effect-option is-privacy" +
                (selectedEffect === "privacy-mask" ? " is-selected" : "")
              }
              type="button"
              aria-pressed={selectedEffect === "privacy-mask"}
              onClick={() => void handleEffectChange("privacy-mask")}
              disabled={
                !cameraReady ||
                joining ||
                effectLoading ||
                effectSupport["privacy-mask"] === "unsupported" ||
                selectedEffect === "privacy-mask"
              }
            >
              <span className="workroom-camera-setup__effect-icon is-mask">
                <FaceRetouchingNaturalRoundedIcon />
              </span>
              <span className="workroom-camera-setup__effect-copy">
                <strong>얼굴 가리기</strong>
                <small>표정을 가리는 보호 마스크</small>
              </span>
            </button>
          </div>

          <p
            className={
              "workroom-camera-setup__effect-status" +
              (effectError ? " is-error" : "")
            }
            role="status"
          >
            {effectLoading
              ? "화면 효과를 준비하고 있습니다."
              : effectError ||
                (!cameraReady
                  ? "카메라 미리보기를 켜면 효과를 선택할 수 있습니다."
                  : selectedEffect === "background-blur"
                    ? "현재 배경 흐림 화면으로 입장합니다."
                    : selectedEffect === "privacy-mask"
                      ? "현재 얼굴 가리기 화면으로 입장합니다."
                    : "현재 원본 화면으로 입장합니다.")}
          </p>
        </div>

        {error && (
          <p className="workroom-camera-setup__error" role="alert">
            {error}
          </p>
        )}

        <div className="workroom-camera-setup__actions">
          <button
            className="workroom-camera-setup__preview"
            type="button"
            onClick={() => void previewCamera(selectedDeviceId || undefined)}
            disabled={joining || cameraReady}
          >
            {cameraReady ? "미리보기 준비됨" : "카메라 미리보기"}
          </button>
          <button
            className="workroom-camera-setup__confirm"
            onClick={() => void onConfirm()}
            type="button"
            disabled={
              joining || effectLoading || !cameraReady || Boolean(effectError)
            }
          >
            {joining
              ? busyLabel
              : cameraReady
                ? confirmLabel
                : "미리보기 후 입장"}
          </button>
        </div>
      </div>
    </section>
  );
}
