import { useEffect, useRef, useState, type ReactNode } from "react";
import BlurOnRoundedIcon from "@mui/icons-material/BlurOnRounded";
import DoorFrontOutlinedIcon from "@mui/icons-material/DoorFrontOutlined";
import FilterNoneRoundedIcon from "@mui/icons-material/FilterNoneRounded";
import VolumeOffRoundedIcon from "@mui/icons-material/VolumeOffRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import {
  useWorkroomSession,
  type CameraEffect,
} from "../context/WorkroomSessionContext";
import {
  getScheduleSoundEnabled,
  playScheduleTone,
  setScheduleSoundEnabled,
} from "../utils/schedule-bell";
import { observeAdaptiveCameraFit } from "../utils/adaptive-camera-fit";
import "./workroom-camera-setup.css";

type WorkroomCameraSetupProps = {
  confirmLabel: string;
  busyLabel?: string;
  onConfirm: () => void | Promise<void>;
};

export default function WorkroomCameraSetup({
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
  const [deviceChanging, setDeviceChanging] = useState(false);
  const [soundChanging, setSoundChanging] = useState(false);
  const [scheduleSoundEnabled, setScheduleSoundPreference] = useState(
    getScheduleSoundEnabled,
  );

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !localVideoTrack) return;

    localVideoTrack.attach(element);
    const stopObservingCameraFit = observeAdaptiveCameraFit(element);
    void element.play().catch(() => undefined);

    return () => {
      stopObservingCameraFit();
      localVideoTrack.detach(element);
    };
  }, [localVideoTrack]);

  const handleEffectChange = async (effect: CameraEffect) => {
    await selectCameraEffect(effect);
  };

  const handleDeviceChange = async (deviceId: string) => {
    if (deviceChanging) return;
    setDeviceChanging(true);
    try {
      await selectCamera(deviceId);
    } finally {
      setDeviceChanging(false);
    }
  };

  const toggleScheduleSound = async () => {
    if (soundChanging) return;
    const next = !scheduleSoundEnabled;
    setSoundChanging(true);
    try {
      const enabled = await setScheduleSoundEnabled(next);
      if (next && !enabled) {
        await setScheduleSoundEnabled(false);
      }
      setScheduleSoundPreference(next && enabled);
      if (next && enabled) playScheduleTone("preview");
    } finally {
      setSoundChanging(false);
    }
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
      deviceChanging ||
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
    original: "효과 없이 원본 화면으로 입장합니다.",
    "background-blur": "현재 배경 흐림 화면으로 입장합니다.",
    cat: "고양이 효과로 코와 입을 가립니다. 눈과 자세는 그대로 보입니다.",
    dog: "강아지 효과로 코와 입을 가립니다. 눈과 자세는 그대로 보입니다.",
    bear: "곰 효과로 코와 입을 가립니다. 눈과 자세는 그대로 보입니다.",
    bunny: "토끼 효과로 코와 입을 가립니다. 눈과 자세는 그대로 보입니다.",
    fox: "여우 효과로 코와 입을 가립니다. 눈과 자세는 그대로 보입니다.",
    "medical-mask":
      "마스크 효과로 코와 입을 가립니다. 눈과 자세는 그대로 보입니다.",
    beard: "수염 효과로 입과 턱을 가립니다. 눈과 자세는 그대로 보입니다.",
    glasses:
      "안경 효과와 밝은 뷰티 톤을 적용합니다. 눈과 자세는 그대로 보입니다.",
  };

  return (
    <section
      className="workroom-camera-setup"
      aria-label="카메라 준비"
      aria-busy={joining || deviceChanging || effectLoading || soundChanging}
    >
      <div className="workroom-camera-setup__preview-panel">
        <div className="workroom-camera-setup__video">
          <video ref={videoRef} muted playsInline />
          {!cameraReady && (
            <span>
              <DoorFrontOutlinedIcon />
              카메라 각도와 기기를 먼저 확인해 주세요.
            </span>
          )}
        </div>

        <div className="workroom-camera-setup__actions">
          <button
            className="workroom-camera-setup__preview"
            type="button"
            onClick={() => void previewCamera(selectedDeviceId || undefined)}
            disabled={joining || deviceChanging || effectLoading || cameraReady}
          >
            {cameraReady ? "미리보기 준비됨" : "카메라 미리보기"}
          </button>
          <button
            aria-label={`교시종소리 ${scheduleSoundEnabled ? "끄기" : "켜기"}`}
            aria-pressed={scheduleSoundEnabled}
            className={
              "workroom-camera-setup__sound" +
              (scheduleSoundEnabled ? " is-on" : "")
            }
            disabled={soundChanging || joining}
            onClick={() => void toggleScheduleSound()}
            title={`교시종소리 ${scheduleSoundEnabled ? "켜짐" : "꺼짐"}`}
            type="button"
          >
            <span className="workroom-camera-setup__sound-label">
              {scheduleSoundEnabled ? (
                <VolumeUpRoundedIcon />
              ) : (
                <VolumeOffRoundedIcon />
              )}
              <span>교시종소리</span>
            </span>
            <span
              aria-hidden="true"
              className="workroom-camera-setup__sound-switch"
            />
          </button>
          <button
            className="workroom-camera-setup__confirm"
            onClick={() => void onConfirm()}
            type="button"
            disabled={
              joining ||
              deviceChanging ||
              effectLoading ||
              soundChanging ||
              !cameraReady ||
              Boolean(effectError)
            }
          >
            {deviceChanging
              ? "카메라 변경 중..."
              : joining
                ? busyLabel
                : cameraReady
                  ? confirmLabel
                  : "미리보기 후 입장"}
          </button>
        </div>

        <p className="workroom-camera-setup__privacy">
          미리보기 화면은 입장 전까지 다른 사람에게 송출되지 않습니다.
        </p>
      </div>

      <div className="workroom-camera-setup__info">
        <label>
          <span>카메라 선택</span>
          <select
            value={selectedDeviceId}
            onChange={(event) => void handleDeviceChange(event.target.value)}
            disabled={
              joining || deviceChanging || effectLoading || devices.length === 0
            }
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
                  "효과 없음",
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
                작업아이템
              </span>
              <div
                className="workroom-camera-setup__effect-options is-work-items"
                role="group"
                aria-label="작업아이템"
              >
                {renderEffect(
                  "cat",
                  "고양이",
                  "리얼 하관 커버와 뷰티 톤",
                  <img
                    src="/effects/cat/muzzle.webp"
                    alt=""
                    aria-hidden="true"
                  />,
                  "is-character is-cat",
                )}
                {renderEffect(
                  "dog",
                  "강아지",
                  "리얼 하관 커버와 뷰티 톤",
                  <img
                    src="/effects/dog/muzzle.webp"
                    alt=""
                    aria-hidden="true"
                  />,
                  "is-character is-dog",
                )}
                {renderEffect(
                  "bear",
                  "곰",
                  "리얼 하관 커버와 뷰티 톤",
                  <img
                    src="/effects/bear/muzzle.webp"
                    alt=""
                    aria-hidden="true"
                  />,
                  "is-character is-bear",
                )}
                {renderEffect(
                  "bunny",
                  "토끼",
                  "리얼 하관 커버와 뷰티 톤",
                  <img
                    src="/effects/bunny/muzzle.webp"
                    alt=""
                    aria-hidden="true"
                  />,
                  "is-character is-bunny",
                )}
                {renderEffect(
                  "fox",
                  "여우",
                  "리얼 하관 커버와 뷰티 톤",
                  <img
                    src="/effects/fox/muzzle.webp"
                    alt=""
                    aria-hidden="true"
                  />,
                  "is-character is-fox",
                )}
                {renderEffect(
                  "medical-mask",
                  "마스크",
                  "의료용 마스크와 뷰티 톤",
                  <img
                    src="/effects/accessories/medical-mask.webp"
                    alt=""
                    aria-hidden="true"
                  />,
                  "is-accessory is-mask",
                )}
                {renderEffect(
                  "beard",
                  "수염",
                  "리얼 수염과 뷰티 톤",
                  <img
                    src="/effects/accessories/beard.webp"
                    alt=""
                    aria-hidden="true"
                  />,
                  "is-accessory is-beard",
                )}
                {renderEffect(
                  "glasses",
                  "안경 뷰티",
                  "빅 프레임과 브라이트 톤",
                  <img
                    src="/effects/accessories/glasses.webp"
                    alt=""
                    aria-hidden="true"
                  />,
                  "is-accessory is-glasses",
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
      </div>
    </section>
  );
}
