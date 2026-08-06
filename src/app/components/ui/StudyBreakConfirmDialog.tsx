import PauseCircleOutlineRoundedIcon from "@mui/icons-material/PauseCircleOutlineRounded";
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import "./study-break-confirm-dialog.css";

type StudyBreakConfirmDialogProps = {
  open: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export default function StudyBreakConfirmDialog({
  open,
  pending,
  onCancel,
  onConfirm,
}: StudyBreakConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousBodyOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      cancelButtonRef.current?.focus();
    });

    document.body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousBodyOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !pending) onCancel();
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!pending) onCancel();
      return;
    }

    if (event.key !== "Tab") return;

    const firstButton = cancelButtonRef.current;
    const lastButton = confirmButtonRef.current;

    if (!firstButton || !lastButton) return;

    if (event.shiftKey && document.activeElement === firstButton) {
      event.preventDefault();
      lastButton.focus();
    } else if (!event.shiftKey && document.activeElement === lastButton) {
      event.preventDefault();
      firstButton.focus();
    }
  };

  return createPortal(
    <div
      className="study-break-confirm"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="study-break-confirm__dialog"
        onKeyDown={handleDialogKeyDown}
        role="dialog"
      >
        <span aria-hidden="true" className="study-break-confirm__icon">
          <PauseCircleOutlineRoundedIcon />
        </span>
        <strong id={titleId}>휴식을 시작할까요?</strong>
        <p id={descriptionId}>
          휴식을 시작하면 공부시간 기록이 먼저 멈추고 카메라만 꺼집니다. ‘계속
          공부하기’를 누르면 카메라를 다시 켠 뒤 기록을 재개합니다.
        </p>
        <div className="study-break-confirm__actions">
          <button
            disabled={pending}
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            계속 공부
          </button>
          <button
            disabled={pending}
            onClick={() => void onConfirm()}
            ref={confirmButtonRef}
            type="button"
          >
            {pending ? "휴식 시작 중…" : "휴식 시작"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
