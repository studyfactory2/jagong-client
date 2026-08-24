import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type {
  AdminEnrollStudyChallengeInput,
  AdminStudyChallengeConsentMethod,
  AdminStudyChallengeEnrollmentPreview,
  AdminUser,
} from "../../../../lib/types";
import { getAdminUsers } from "../../../services/admin.service";
import { HttpRequestError } from "../../../services/http";
import {
  enrollAdminStudyChallenge,
  getAdminStudyChallengeEnrollment,
} from "../../../services/study-challenge.service";
import {
  FIRST_FAILURE_ENDS_RULES_VERSION,
  studyChallengeRewardLabel,
  studyChallengeRulesPdfUrl,
} from "../../../utils/study-challenge-rules";
import { periodText, targetText } from "./admin-challenge.helpers";

const MEMBER_SEARCH_DELAY_MS = 350;
const MEMBER_SEARCH_LIMIT = 12;
const CONSENT_EVIDENCE_MAX_LENGTH = 500;

type EnrollmentOutcome = "created" | "observed";

type AdminChallengeEnrollmentDialogProps = {
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onRequestClose: () => void;
  onResolved: (memberName: string, outcome: EnrollmentOutcome) => void;
};

type PreviewContract = {
  userId: string;
  rulesVersion: string;
  startsAt: string;
  endsAtExclusive: string;
};

type SubmissionSnapshot = PreviewContract & {
  input: AdminEnrollStudyChallengeInput;
};

function localDateTimeInputValue(date = new Date()): string {
  const localTime = new Date(
    date.getTime() - date.getTimezoneOffset() * 60 * 1000,
  );
  return localTime.toISOString().slice(0, 16);
}

function isPastOrPresentConsentTime(value: string): boolean {
  const consentDate = new Date(value);
  return (
    Boolean(value) &&
    !Number.isNaN(consentDate.getTime()) &&
    consentDate.getTime() <= Date.now()
  );
}

function previewContract(
  userId: string,
  preview: AdminStudyChallengeEnrollmentPreview,
): PreviewContract {
  return {
    userId,
    rulesVersion: preview.joinRules.version,
    startsAt: preview.nextChallenge.startsAt,
    endsAtExclusive: preview.nextChallenge.endsAtExclusive,
  };
}

function samePreviewContract(
  left: PreviewContract | null,
  right: PreviewContract | null,
): boolean {
  return Boolean(
    left &&
    right &&
    left.userId === right.userId &&
    left.rulesVersion === right.rulesVersion &&
    left.startsAt === right.startsAt &&
    left.endsAtExclusive === right.endsAtExclusive,
  );
}

function memberMeta(member: AdminUser): string {
  return (
    [member.branch?.name, member.examType, member.phone]
      .filter(Boolean)
      .join(" · ") || "회원 정보 확인 필요"
  );
}

function memberState(member: AdminUser): string {
  if (member.memberStatus === "BLOCKED") return "차단";
  if (member.isActive === false) return "비활성";
  return "자격 확인";
}

export default function AdminChallengeEnrollmentDialog({
  returnFocusRef,
  onRequestClose,
  onResolved,
}: AdminChallengeEnrollmentDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLFormElement | null>(null);
  const memberSearchRequestRef = useRef(0);
  const previewRequestRef = useRef(0);
  const selectedMemberIdRef = useRef("");
  const previewContractRef = useRef<PreviewContract | null>(null);
  const enrollmentInFlightRef = useRef(false);
  const submissionSnapshotRef = useRef<SubmissionSnapshot | null>(null);

  const [searchText, setSearchText] = useState("");
  const [searchRetryToken, setSearchRetryToken] = useState(0);
  const [members, setMembers] = useState<AdminUser[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberSearchLoading, setMemberSearchLoading] = useState(true);
  const [memberSearchError, setMemberSearchError] = useState("");
  const [selectedMember, setSelectedMember] = useState<AdminUser | null>(null);
  const [preview, setPreview] =
    useState<AdminStudyChallengeEnrollmentPreview | null>(null);
  const [previewUserId, setPreviewUserId] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [consentMethod, setConsentMethod] = useState<
    AdminStudyChallengeConsentMethod | ""
  >("");
  const [consentedAt, setConsentedAt] = useState(() =>
    localDateTimeInputValue(),
  );
  const [consentEvidence, setConsentEvidence] = useState("");
  const [confirmedConsent, setConfirmedConsent] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasFrozenSubmission, setHasFrozenSubmission] = useState(false);

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
      searchRef.current?.focus();
    });
    document.body.style.overflow = "hidden";

    return () => {
      memberSearchRequestRef.current += 1;
      previewRequestRef.current += 1;
      selectedMemberIdRef.current = "";
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

  useEffect(() => {
    const requestId = ++memberSearchRequestRef.current;
    const timer = window.setTimeout(async () => {
      if (requestId !== memberSearchRequestRef.current) return;
      setMemberSearchLoading(true);
      setMemberSearchError("");
      try {
        const result = await getAdminUsers({
          page: 1,
          limit: MEMBER_SEARCH_LIMIT,
          role: "MEMBER",
          text: searchText.trim() || undefined,
        });
        if (requestId !== memberSearchRequestRef.current) return;
        setMembers(result.list.filter((member) => member.role === "MEMBER"));
        setMemberTotal(result.total);
      } catch (error) {
        if (requestId !== memberSearchRequestRef.current) return;
        setMembers([]);
        setMemberTotal(0);
        setMemberSearchError(
          error instanceof Error
            ? error.message
            : "회원 목록을 불러오지 못했습니다.",
        );
      } finally {
        if (requestId === memberSearchRequestRef.current) {
          setMemberSearchLoading(false);
        }
      }
    }, MEMBER_SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      if (requestId === memberSearchRequestRef.current) {
        memberSearchRequestRef.current += 1;
      }
    };
  }, [searchRetryToken, searchText]);

  function resetConsentInputs() {
    const currentLocalTime = localDateTimeInputValue();
    submissionSnapshotRef.current = null;
    setHasFrozenSubmission(false);
    setConsentMethod("");
    setConsentedAt(currentLocalTime);
    setConsentEvidence("");
    setConfirmedConsent(false);
  }

  function invalidateSubmissionSnapshot() {
    submissionSnapshotRef.current = null;
    setHasFrozenSubmission(false);
    setSubmissionError("");
  }

  function clearSelectedMember() {
    previewRequestRef.current += 1;
    selectedMemberIdRef.current = "";
    previewContractRef.current = null;
    setSelectedMember(null);
    setPreview(null);
    setPreviewUserId("");
    setPreviewLoading(false);
    setPreviewError("");
    setSubmissionError("");
    resetConsentInputs();
  }

  async function loadPreview(
    member: AdminUser,
  ): Promise<AdminStudyChallengeEnrollmentPreview | null | undefined> {
    const requestId = ++previewRequestRef.current;
    const previousContract = previewContractRef.current;
    setPreview(null);
    setPreviewUserId("");
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const next = await getAdminStudyChallengeEnrollment(member.id);
      if (
        requestId !== previewRequestRef.current ||
        selectedMemberIdRef.current !== member.id
      ) {
        return undefined;
      }
      const nextContract = previewContract(member.id, next);
      if (
        previousContract &&
        !samePreviewContract(previousContract, nextContract)
      ) {
        resetConsentInputs();
      }
      previewContractRef.current = nextContract;
      setPreview(next);
      setPreviewUserId(member.id);
      return next;
    } catch (error) {
      if (
        requestId !== previewRequestRef.current ||
        selectedMemberIdRef.current !== member.id
      ) {
        return undefined;
      }
      setPreviewError(
        error instanceof Error
          ? error.message
          : "도전 참여 가능 여부를 확인하지 못했습니다.",
      );
      return null;
    } finally {
      if (
        requestId === previewRequestRef.current &&
        selectedMemberIdRef.current === member.id
      ) {
        setPreviewLoading(false);
      }
    }
  }

  function changeSearchText(value: string) {
    if (submitting) return;
    setSearchText(value);
    setMembers([]);
    setMemberTotal(0);
    setMemberSearchLoading(true);
    setMemberSearchError("");
    clearSelectedMember();
  }

  function selectMember(member: AdminUser) {
    if (submitting || selectedMemberIdRef.current === member.id) return;
    previewRequestRef.current += 1;
    selectedMemberIdRef.current = member.id;
    previewContractRef.current = null;
    setSelectedMember(member);
    setPreview(null);
    setPreviewUserId("");
    setPreviewError("");
    setSubmissionError("");
    resetConsentInputs();
    void loadPreview(member);
  }

  function requestClose() {
    if (submitting) return;
    memberSearchRequestRef.current += 1;
    previewRequestRef.current += 1;
    selectedMemberIdRef.current = "";
    onRequestClose();
  }

  function handleDialogClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) requestClose();
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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

  function completeEnrollment(memberName: string, outcome: EnrollmentOutcome) {
    memberSearchRequestRef.current += 1;
    previewRequestRef.current += 1;
    selectedMemberIdRef.current = "";
    onResolved(memberName, outcome);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const member = selectedMember;
    const visiblePreview = previewUserId === member?.id ? preview : null;
    const contract = previewContractRef.current;
    if (
      !member ||
      !visiblePreview?.canJoin ||
      !contract ||
      contract.userId !== member.id ||
      !consentMethod ||
      !confirmedConsent ||
      !consentEvidence.trim() ||
      enrollmentInFlightRef.current ||
      submitting
    ) {
      return;
    }

    let snapshot = submissionSnapshotRef.current;
    if (!snapshot) {
      if (!isPastOrPresentConsentTime(consentedAt)) {
        setSubmissionError(
          "실제 회원 동의 시각을 현재 이전으로 입력해 주세요.",
        );
        return;
      }
      const consentDate = new Date(consentedAt);
      snapshot = {
        ...contract,
        input: {
          confirmedMemberConsent: true,
          rulesVersion: contract.rulesVersion,
          startsAt: contract.startsAt,
          endsAtExclusive: contract.endsAtExclusive,
          consentMethod,
          consentedAt: consentDate.toISOString(),
          consentEvidence: consentEvidence.trim(),
        },
      };
      submissionSnapshotRef.current = snapshot;
      setHasFrozenSubmission(true);
    }

    enrollmentInFlightRef.current = true;
    previewRequestRef.current += 1;
    setSubmitting(true);
    setSubmissionError("");
    try {
      await enrollAdminStudyChallenge(snapshot.userId, snapshot.input);
      completeEnrollment(member.name, "created");
    } catch (error) {
      const originalMessage =
        error instanceof Error
          ? error.message
          : "관리자 대리 등록을 처리하지 못했습니다.";
      const responseStatus =
        error instanceof HttpRequestError ? error.status : null;
      const outcomeMayBeAmbiguous =
        responseStatus === null || responseStatus >= 500;
      const refreshed = await loadPreview(member);
      if (refreshed === undefined) return;
      if (refreshed?.isParticipating && refreshed.currentChallenge) {
        const observedChallenge = refreshed.currentChallenge;
        const observedContractMatches =
          observedChallenge.rulesVersion === snapshot.rulesVersion &&
          observedChallenge.startsAt === snapshot.startsAt &&
          observedChallenge.endsAtExclusive === snapshot.endsAtExclusive;
        if (observedContractMatches) {
          completeEnrollment(member.name, "observed");
          return;
        }
        resetConsentInputs();
        setSubmissionError(
          `${originalMessage} 서버에서 다른 규칙 또는 기간의 도전 등록을 확인했습니다. 현재 참여 기록을 확인한 뒤 다시 진행해 주세요.`,
        );
        return;
      }
      if (!refreshed) {
        if (!outcomeMayBeAmbiguous) {
          submissionSnapshotRef.current = null;
          setHasFrozenSubmission(false);
          setConfirmedConsent(false);
        }
        setSubmissionError(
          outcomeMayBeAmbiguous
            ? `${originalMessage} 처리 결과를 서버에서 다시 확인하지 못했습니다. 상태 확인 후 동일한 내용으로 다시 시도해 주세요.`
            : `${originalMessage} 서버가 등록 요청을 거절했고 최신 상태도 다시 확인하지 못했습니다. 입력과 회원 상태를 확인해 주세요.`,
        );
        return;
      }

      const refreshedContract = previewContract(member.id, refreshed);
      if (!refreshed.canJoin) {
        submissionSnapshotRef.current = null;
        setHasFrozenSubmission(false);
        setConfirmedConsent(false);
        setSubmissionError(
          `${originalMessage} 최신 상태: ${refreshed.unavailableReason ?? "현재 등록할 수 없습니다."}`,
        );
        return;
      }
      if (!samePreviewContract(snapshot, refreshedContract)) {
        resetConsentInputs();
        setSubmissionError(
          `${originalMessage} 도전 규칙 또는 기간이 변경되었습니다. 최신 내용을 안내하고 회원 동의를 다시 확인해 주세요.`,
        );
        return;
      }
      if (!outcomeMayBeAmbiguous) {
        submissionSnapshotRef.current = null;
        setHasFrozenSubmission(false);
        setConfirmedConsent(false);
        setSubmissionError(
          `${originalMessage} 서버가 요청을 거절했습니다. 안내 내용을 확인하고 필요한 상태를 수정한 뒤 다시 확인해 주세요.`,
        );
        return;
      }
      setSubmissionError(
        `${originalMessage} 서버에서 아직 등록 가능한 상태를 확인했습니다. 같은 내용으로 다시 시도할 수 있습니다.`,
      );
    } finally {
      enrollmentInFlightRef.current = false;
      if (selectedMemberIdRef.current === member.id) {
        setSubmitting(false);
      }
    }
  }

  const visiblePreview =
    selectedMember && previewUserId === selectedMember.id ? preview : null;
  const rewardLabel = visiblePreview
    ? studyChallengeRewardLabel(visiblePreview.joinRules.version)
    : null;
  const rulesPdfUrl = visiblePreview
    ? studyChallengeRulesPdfUrl(visiblePreview.joinRules.version)
    : null;
  const firstFailureEndsChallenge =
    visiblePreview?.joinRules.version === FIRST_FAILURE_ENDS_RULES_VERSION;
  const canSubmit = Boolean(
    selectedMember &&
      visiblePreview?.canJoin &&
      rewardLabel &&
    consentMethod &&
    consentedAt &&
    consentEvidence.trim() &&
    confirmedConsent &&
    !submitting,
  );
  const portalTarget =
    document.querySelector<HTMLElement>(".app-shell.admin-shell") ??
    document.body;

  return createPortal(
    <div
      className="admin-challenge-enrollment-dialog"
      onClick={handleDialogClick}
      role="presentation"
    >
      <form
        aria-busy={submitting}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="admin-challenge-enrollment-dialog-card"
        onKeyDown={handleDialogKeyDown}
        onSubmit={(event) => void handleSubmit(event)}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="admin-challenge-enrollment-dialog-heading">
          <span aria-hidden="true">
            <PersonAddAltOutlinedIcon />
          </span>
          <div>
            <small>관리자 대리 등록</small>
            <h2 id={titleId}>회원의 공부 도전을 등록합니다</h2>
            <p id={descriptionId}>
              회원에게 최신 규칙과 정확한 기간을 안내하고 실제 참여 동의를 받은
              경우에만 등록해 주세요.
            </p>
          </div>
        </header>

        <section className="admin-challenge-enrollment-member-search">
          <label>
            <span>회원 검색</span>
            <div>
              <SearchOutlinedIcon aria-hidden="true" />
              <input
                disabled={submitting}
                onChange={(event) => changeSearchText(event.target.value)}
                placeholder="회원명, 연락처 또는 시험"
                ref={searchRef}
                type="search"
                value={searchText}
              />
            </div>
          </label>

          {memberSearchError && (
            <div
              className="admin-challenge-enrollment-search-error"
              role="alert"
            >
              <span>{memberSearchError}</span>
              <button
                disabled={submitting}
                onClick={() => setSearchRetryToken((current) => current + 1)}
                type="button"
              >
                다시 불러오기
              </button>
            </div>
          )}

          <div
            aria-busy={memberSearchLoading}
            aria-label="등록할 회원 선택"
            className="admin-challenge-enrollment-member-list"
          >
            {memberSearchLoading && !members.length && (
              <p>회원 목록을 불러오는 중입니다.</p>
            )}
            {!memberSearchLoading && !memberSearchError && !members.length && (
              <p>조건에 맞는 회원이 없습니다.</p>
            )}
            {members.map((member) => (
              <button
                aria-pressed={selectedMember?.id === member.id}
                className={
                  selectedMember?.id === member.id ? "is-selected" : undefined
                }
                disabled={submitting}
                key={member.id}
                onClick={() => selectMember(member)}
                type="button"
              >
                <span aria-hidden="true">{member.name.slice(0, 1)}</span>
                <span>
                  <strong>{member.name}</strong>
                  <small>{memberMeta(member)}</small>
                </span>
                <em>{memberState(member)}</em>
              </button>
            ))}
          </div>
          {!memberSearchLoading && memberTotal > MEMBER_SEARCH_LIMIT && (
            <small className="admin-challenge-enrollment-search-guide">
              총 {memberTotal}명 중 앞의 {MEMBER_SEARCH_LIMIT}명입니다. 검색어로
              회원을 좁혀 주세요.
            </small>
          )}
        </section>

        <section className="admin-challenge-enrollment-preview">
          {!selectedMember && (
            <p className="admin-challenge-enrollment-preview-state">
              등록할 회원을 먼저 선택해 주세요.
            </p>
          )}

          {selectedMember && (
            <header>
              <span aria-hidden="true">{selectedMember.name.slice(0, 1)}</span>
              <div>
                <strong>{selectedMember.name}</strong>
                <small>{memberMeta(selectedMember)}</small>
              </div>
            </header>
          )}

          {selectedMember && previewLoading && (
            <p
              aria-busy="true"
              className="admin-challenge-enrollment-preview-state"
            >
              최신 참여 가능 여부를 확인하는 중입니다.
            </p>
          )}

          {selectedMember && previewError && !previewLoading && (
            <div
              className="admin-challenge-enrollment-preview-error"
              role="alert"
            >
              <span>{previewError}</span>
              <button
                disabled={submitting}
                onClick={() => void loadPreview(selectedMember)}
                type="button"
              >
                다시 확인하기
              </button>
            </div>
          )}

          {selectedMember && visiblePreview && !visiblePreview.canJoin && (
            <p className="admin-challenge-enrollment-unavailable" role="status">
              <strong>현재 등록할 수 없습니다.</strong>
              {visiblePreview.unavailableReason ??
                "회원의 최신 이용권과 도전 상태를 확인해 주세요."}
            </p>
          )}

          {selectedMember && visiblePreview?.canJoin && (
            <>
              <dl className="admin-challenge-enrollment-contract">
                <div>
                  <dt>도전 기간</dt>
                  <dd>
                    {periodText(
                      visiblePreview.nextChallenge.startsAt,
                      visiblePreview.nextChallenge.endsAtExclusive,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>주간 목표</dt>
                  <dd>
                    {visiblePreview.joinRules.requiredWeeks}주 · 매주{" "}
                    {targetText(visiblePreview.joinRules.weeklyTargetSeconds)}
                  </dd>
                </div>
                <div>
                  <dt>규칙 버전</dt>
                  <dd>{visiblePreview.joinRules.version}</dd>
                </div>
              </dl>

              {!rewardLabel ? (
                <p
                  className="admin-challenge-enrollment-unavailable"
                  role="status"
                >
                  <strong>규칙 업데이트가 필요합니다.</strong>
                  이 앱이 알지 못하는 도전 규칙입니다. 최신 화면을 배포한 뒤
                  회원에게 정확한 규칙을 안내해 주세요.
                </p>
              ) : (
                <>
                  <ul className="admin-challenge-enrollment-rules">
                    <li>
                      매주 월요일부터 일요일까지 실제 공부시간{" "}
                      {targetText(
                        visiblePreview.joinRules.weeklyTargetSeconds,
                      )}
                      을 달성해야 합니다.
                    </li>
                    <li>
                      {visiblePreview.joinRules.requiredWeeks}주 모두 각각
                      달성해야 하며 남은 시간은 다음 주로 이월되지 않습니다.
                    </li>
                    {firstFailureEndsChallenge && (
                      <>
                        <li>
                          참여 확정 시 유료 이용권은 1개월분당 1회, 도전 보상
                          이용권은 1회분의 참여 기회를 사용하며,
                          성공·미달성·취소·중도 포기 여부와 관계없이 복구되지
                          않습니다.
                        </li>
                        <li>
                          도전이 조기 종료되거나 취소되어도 처음 안내된 4주
                          기간이 끝나기 전에는 다음 도전에 참여할 수 없습니다.
                        </li>
                        <li>
                          한 주라도 목표에 미달하면 해당 주차 종료 후 도전이
                          즉시 종료되며, 이후 주차는 진행·집계되지 않습니다.
                        </li>
                      </>
                    )}
                    <li>
                      휴식 상태는 제외되며, 휴식시간에 ‘계속 공부하기’를 선택한
                      시간은 포함됩니다.
                    </li>
                    <li>
                      4주 모두 달성하면 {rewardLabel} 보상이 지급됩니다.
                      {firstFailureEndsChallenge &&
                        " 해당 보상 이용권으로 다음 도전에 다시 참여할 수 있습니다."}
                    </li>
                    <li>
                      참여 확정 후 취소·중도 포기를 선택할 수 있지만, 안내된
                      참여 기회와 기간 제한은 그대로 적용됩니다.
                    </li>
                  </ul>

                  <div className="admin-challenge-enrollment-consent-fields">
                <label>
                  <span>동의 방법</span>
                  <select
                    disabled={submitting}
                    onChange={(event) => {
                      invalidateSubmissionSnapshot();
                      setConsentMethod(
                        event.target.value as
                          | AdminStudyChallengeConsentMethod
                          | "",
                      );
                    }}
                    required
                    value={consentMethod}
                  >
                    <option value="">선택해 주세요</option>
                    <option value="PHONE">전화</option>
                    <option value="IN_PERSON">대면</option>
                    <option value="WRITTEN">서면</option>
                  </select>
                </label>
                <label>
                  <span>실제 회원 동의 시각</span>
                  <input
                    disabled={submitting}
                    onChange={(event) => {
                      invalidateSubmissionSnapshot();
                      setConsentedAt(event.target.value);
                    }}
                    required
                    type="datetime-local"
                    value={consentedAt}
                  />
                </label>
              </div>

              <label className="admin-challenge-enrollment-evidence">
                <span>동의 근거</span>
                <textarea
                  disabled={submitting}
                  maxLength={CONSENT_EVIDENCE_MAX_LENGTH}
                  onChange={(event) => {
                    invalidateSubmissionSnapshot();
                    setConsentEvidence(event.target.value);
                  }}
                  placeholder="예: 8월 24일 대면 상담 중 4주 규칙과 기간 안내 후 회원이 참여에 동의함"
                  required
                  rows={3}
                  value={consentEvidence}
                />
                <small>
                  감사 기록에 남습니다. {consentEvidence.length} /{" "}
                  {CONSENT_EVIDENCE_MAX_LENGTH}
                </small>
              </label>

              <p className="admin-challenge-enrollment-interest-warning">
                상담에서 표시한 참여 희망만으로는 동의가 되지 않습니다. 위
                규칙과 기간에 대한 회원의 실제 답변을 기록해 주세요.
              </p>

              {rulesPdfUrl && (
                <a
                  className="admin-challenge-enrollment-policy-link"
                  href={rulesPdfUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  도전 규칙 전문 PDF 보기 (새 창)
                </a>
              )}

              <label className="admin-challenge-enrollment-agreement">
                <input
                  checked={confirmedConsent}
                  disabled={submitting}
                  onChange={(event) => {
                    invalidateSubmissionSnapshot();
                    setConfirmedConsent(event.target.checked);
                  }}
                  type="checkbox"
                />
                <span>
                  회원에게 표시된 규칙 버전과 정확한 4주 기간을 안내했고, 회원이
                  참여에 동의했음을 확인합니다.
                </span>
                  </label>
                </>
              )}
            </>
          )}
        </section>

        {submissionError && (
          <p className="admin-challenge-enrollment-dialog-error" role="alert">
            {submissionError}
          </p>
        )}

        <div className="admin-challenge-enrollment-dialog-actions">
          <button disabled={submitting} onClick={requestClose} type="button">
            닫기
          </button>
          <button disabled={!canSubmit} type="submit">
            {submitting
              ? "등록 처리 중…"
              : hasFrozenSubmission
                ? "같은 내용으로 다시 시도"
                : "회원 도전 등록"}
          </button>
        </div>
      </form>
    </div>,
    portalTarget,
  );
}
