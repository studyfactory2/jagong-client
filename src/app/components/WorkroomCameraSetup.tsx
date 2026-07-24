import { useEffect, useRef, type ReactNode } from "react";
import BlurOnRoundedIcon from "@mui/icons-material/BlurOnRounded";
import DoorFrontOutlinedIcon from "@mui/icons-material/DoorFrontOutlined";
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

  const renderEffect = (
    id: CameraEffect,
    title: string,
    desc: string,
    icon: ReactNode,
    iconClass: string,
  ) => {
    const isOriginal = id === "original";
    const selected = selectedEffect === id;
    const unsupported =
      !isOriginal &&
      effectSupport[id as Exclude<CameraEffect, "original">] === "unsupported";
    const disabled =
      !cameraReady ||
      joining ||
      effectLoading ||
      (isOriginal ? selected && !effectError : unsupported || selected);
    return (
      <button
        key={id}
        className={
          "workroom-camera-setup__effect-option" +
          (selected ? " is-selected" : "")
        }
        type="button"
        aria-pressed={selected}
        onClick={() => void handleEffectChange(id)}
        disabled={disabled}
      >
        <span className={"workroom-camera-setup__effect-icon " + iconClass}>
          {icon}
        </span>
        <span className="workroom-camera-setup__effect-copy">
          <strong>{title}</strong>
          <small>{desc}</small>
        </span>
      </button>
    );
  };

  const enteringMessages: Record<CameraEffect, string> = {
    original: "현재 원본 화면으로 입장합니다.",
    "background-blur": "현재 배경 흐림 화면으로 입장합니다.",
    cat: "고양이 효과로 입장합니다. 눈과 자세는 그대로 보입니다.",
    dog: "강아지 효과로 입장합니다. 눈과 자세는 그대로 보입니다.",
    bear: "곰 효과로 입장합니다. 눈과 자세는 그대로 보입니다.",
    bunny: "토끼 효과로 입장합니다. 눈과 자세는 그대로 보입니다.",
    fox: "여우 효과로 입장합니다. 눈과 자세는 그대로 보입니다.",
  };

  return (
    <section
      className="workroom-camera-setup"
      aria-labelledby="camera-setup-title"
    >
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

          <div className="workroom-camera-setup__effect-groups">
            <div className="workroom-camera-setup__effect-group">
              <span className="workroom-camera-setup__effect-group-label">
                기본 화면
              </span>
              <div
                className="workroom-camera-setup__effect-options"
                role="group"
                aria-label="기본 화면"
              >
                {renderEffect(
                  "original",
                  "원본",
                  "가공하지 않은 화면",
                  <FilterNoneRoundedIcon />,
                  "is-original",
                )}
                {renderEffect(
                  "background-blur",
                  "배경 흐림",
                  "주변 공간을 부드럽게",
                  <BlurOnRoundedIcon />,
                  "is-blur",
                )}
              </div>
            </div>

            <div className="workroom-camera-setup__effect-group">
              <span className="workroom-camera-setup__effect-group-label">
                캐릭터 · 눈은 항상 보임
              </span>
              <div
                className="workroom-camera-setup__effect-options"
                role="group"
                aria-label="캐릭터 화면"
              >
                {renderEffect(
                  "cat",
                  "고양이",
                  "뾰족한 귀와 수염",
                  <span aria-hidden="true">🐱</span>,
                  "is-character is-cat",
                )}
                {renderEffect(
                  "dog",
                  "강아지",
                  "축 늘어진 귀",
                  <span aria-hidden="true">🐶</span>,
                  "is-character is-dog",
                )}
                {renderEffect(
                  "bear",
                  "곰",
                  "동그란 귀",
                  <span aria-hidden="true">🐻</span>,
                  "is-character is-bear",
                )}
                {renderEffect(
                  "bunny",
                  "토끼",
                  "길쭉한 귀",
                  <span aria-hidden="true">🐰</span>,
                  "is-character is-bunny",
                )}
                {renderEffect(
                  "fox",
                  "여우",
                  "뾰족한 귀",
                  <span aria-hidden="true">🦊</span>,
                  "is-character is-fox",
                )}
              </div>
            </div>
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
                  : enteringMessages[selectedEffect])}
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
