import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

type AdminChallengeTerminationDialogProps = {
  memberName: string;
  periodLabel: string;
  reason: string;
  confirmed: boolean;
  error: string;
  submitting: boolean;
  reasonMaxLength: number;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onReasonChange: (value: string) => void;
  onConfirmedChange: (value: boolean) => void;
  onRequestClose: () => void;
  onSubmit: () => void;
};

export default function AdminChallengeTerminationDialog({
  memberName,
  periodLabel,
  reason,
  confirmed,
  error,
  submitting,
  reasonMaxLength,
  returnFocusRef,
  onReasonChange,
  onConfirmedChange,
  onRequestClose,
  onSubmit,
}: AdminChallengeTerminationDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previouslyFocused = returnFocusRef.current?.isConnected
      ? returnFocusRef.current
      : activeElement;
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      reasonRef.current?.focus();
    });
    document.body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [returnFocusRef]);

  useEffect(() => {
    if (!submitting) return;
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [submitting]);

  function requestClose() {
    if (submitting) return;
    onRequestClose();
  }

  function handleDialogClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) requestClose();
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const activeElement = document.activeElement;
    const dialogHasFocus = activeElement === dialogRef.current;
    if (
      event.shiftKey &&
      (dialogHasFocus ||
        activeElement === first ||
        !dialogRef.current?.contains(activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (dialogHasFocus ||
        activeElement === last ||
        !dialogRef.current?.contains(activeElement))
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  const portalTarget =
    document.querySelector<HTMLElement>(".app-shell.admin-shell") ??
    document.body;

  return createPortal(
    <div
      className="admin-challenge-termination-dialog"
      onClick={handleDialogClick}
      role="presentation"
    >
      <div
        aria-busy={submitting}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="admin-challenge-termination-dialog-card"
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <span
          aria-hidden="true"
          className="admin-challenge-termination-dialog-icon"
        >
          <ReportProblemOutlinedIcon />
        </span>

        <div className="admin-challenge-termination-dialog-heading">
          <small>관리자 처리</small>
          <h2 id={titleId}>이 회원의 도전을 종료할까요?</h2>
          <p id={descriptionId}>
            처리 시각이 도전 시작 전이면 참여 취소, 시작 후이면 중도 포기로
            기록됩니다.
          </p>
        </div>

        <dl className="admin-challenge-termination-member">
          <div>
            <dt>회원</dt>
            <dd>{memberName}</dd>
          </div>
          <div>
            <dt>도전 기간</dt>
            <dd>{periodLabel}</dd>
          </div>
        </dl>

        <p className="admin-challenge-termination-refund-warning">
          <strong>이 작업은 결제 환불이 아닙니다.</strong>
          결제 환불이 필요한 경우 이 창을 닫고 결제 관리에서 처리해 주세요.
        </p>

        <ul className="admin-challenge-termination-rules">
          <li>이번 도전에 사용한 참여 기회는 복구되지 않습니다.</li>
          <li>
            처음 확정한 4주 기간이 끝나기 전에는 다음 도전에 참여할 수 없습니다.
          </li>
          <li>
            남은 주차는 미진행 처리되며 이후 공부시간은 이 도전에 집계되지
            않습니다.
          </li>
          <li>이 도전으로 추가된 이용기간이 있다면 종료와 함께 회수됩니다.</li>
        </ul>

        <label className="admin-challenge-termination-reason">
          <span>관리자 종료 사유</span>
          <textarea
            disabled={submitting}
            maxLength={reasonMaxLength}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="회원 요청, 상담 내용 등 종료 근거를 입력해 주세요."
            ref={reasonRef}
            required
            rows={4}
            value={reason}
          />
          <small>
            감사 기록에 남습니다. {reason.length} / {reasonMaxLength}
          </small>
        </label>

        <label className="admin-challenge-termination-agreement">
          <input
            checked={confirmed}
            disabled={submitting}
            onChange={(event) => onConfirmedChange(event.target.checked)}
            type="checkbox"
          />
          <span>
            결제 환불이 아니며, 참여 기회·4주 제한·남은 주차 처리와 이용기간 회수
            조건을 확인했습니다.
          </span>
        </label>

        {error && (
          <p className="admin-challenge-termination-dialog-error" role="alert">
            {error}
          </p>
        )}

        <div className="admin-challenge-termination-dialog-actions">
          <button disabled={submitting} onClick={requestClose} type="button">
            도전 유지
          </button>
          <button
            disabled={submitting || !confirmed || !reason.trim()}
            onClick={onSubmit}
            type="button"
          >
            {submitting ? "종료 처리 중…" : "관리자 종료"}
          </button>
        </div>
      </div>
    </div>,
    portalTarget,
  );
}
