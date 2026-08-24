import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import type { RefObject } from "react";
import type {
  AdminStudyChallengeDetail,
  AdminStudyChallengeListItem,
} from "../../../../lib/types";
import {
  actorRoleLabel,
  canTerminateChallenge,
  consentMethodLabel,
  dateTimeText,
  displayedPendingWeekCount,
  displayedUnstartedWeekCount,
  durationText,
  eligibilityLabel,
  isTerminalChallengeStatus,
  lifecycleEventLabel,
  lifecycleSourceLabel,
  periodText,
  statusLabel,
  targetText,
  terminationReasonLabel,
  terminationUnavailableMessage,
  weekStatusLabel,
  weekStudySeconds,
} from "./admin-challenge.helpers";

type AdminChallengeDetailProps = {
  selectedSummary: AdminStudyChallengeListItem | null;
  detail: AdminStudyChallengeDetail | null;
  listLoading: boolean;
  detailLoading: boolean;
  detailError: string;
  hasActionNotice: boolean;
  terminating: boolean;
  mobileBackRef: RefObject<HTMLButtonElement | null>;
  terminationTriggerRef: RefObject<HTMLButtonElement | null>;
  onBack: () => void;
  onRetry: (challengeId: string) => void;
  onRequestTermination: (detail: AdminStudyChallengeDetail) => void;
};

export default function AdminChallengeDetail({
  selectedSummary,
  detail,
  listLoading,
  detailLoading,
  detailError,
  hasActionNotice,
  terminating,
  mobileBackRef,
  terminationTriggerRef,
  onBack,
  onRetry,
  onRequestTermination,
}: AdminChallengeDetailProps) {
  const detailTarget = detail?.weeklyTargetSeconds ?? 0;
  const currentStudySeconds = detail?.currentWeekProgress?.studySeconds ?? 0;
  const lifecycleEvents = detail?.lifecycleEvents ?? [];
  const periodEndedWhileUnreconciled = Boolean(
    detail &&
      (detail.status === "SCHEDULED" || detail.status === "ACTIVE") &&
      !canTerminateChallenge(detail),
  );

  return (
    <article className="admin-challenge-detail">
      <button
        className="admin-challenge-mobile-back"
        onClick={onBack}
        ref={mobileBackRef}
        type="button"
      >
        <ArrowBackOutlinedIcon /> 참여자 목록
      </button>

      {!selectedSummary && !listLoading && (
        <div className="admin-challenge-detail-state">
          <EmojiEventsOutlinedIcon />
          <strong>확인할 참여자를 선택해 주세요.</strong>
          <span>도전 기간과 주차별 공부시간을 확인할 수 있습니다.</span>
        </div>
      )}

      {selectedSummary && detailLoading && (
        <div className="admin-challenge-detail-state" aria-busy="true">
          <strong>도전 상세 정보를 불러오는 중입니다.</strong>
        </div>
      )}

      {selectedSummary && detailError && !detailLoading && (
        <div className="admin-challenge-detail-state is-error" role="alert">
          <strong>{detailError}</strong>
          <button onClick={() => onRetry(selectedSummary.id)} type="button">
            다시 불러오기
          </button>
        </div>
      )}

      {detail && !detailLoading && (
        <>
          <header className="admin-challenge-detail-head">
            <div>
              <span aria-hidden="true" className="admin-challenge-avatar">
                {detail.member.name.slice(0, 1)}
              </span>
              <span>
                <strong>{detail.member.name}</strong>
                <small>
                  {[
                    detail.member.branch?.name,
                    detail.member.examType,
                    detail.member.phone,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "회원 정보 없음"}
                </small>
              </span>
            </div>
            <em
              className={`admin-challenge-status is-${detail.status.toLowerCase()}`}
            >
              {statusLabel(detail.status)}
            </em>
          </header>

          <dl className="admin-challenge-facts">
            <div>
              <dt>도전 기간</dt>
              <dd>{periodText(detail.startsAt, detail.endsAtExclusive)}</dd>
            </div>
            <div>
              <dt>주간 목표</dt>
              <dd>
                {detail.requiredWeeks}주 · 매주 {targetText(detailTarget)}
              </dd>
            </div>
            <div>
              <dt>참여 확정</dt>
              <dd>{dateTimeText(detail.confirmedAt)}</dd>
            </div>
            <div>
              <dt>참여 자격</dt>
              <dd>{eligibilityLabel(detail.eligibilityKind)}</dd>
            </div>
            <div>
              <dt>규칙 버전</dt>
              <dd>{detail.rulesVersion ?? "확인 필요"}</dd>
            </div>
            <div>
              <dt>최종 정산</dt>
              <dd>{dateTimeText(detail.finalizedAt)}</dd>
            </div>
          </dl>

          {!hasActionNotice && periodEndedWhileUnreconciled && (
            <p className="admin-challenge-settlement-notice" role="status">
              {terminationUnavailableMessage(detail)}
            </p>
          )}

          {canTerminateChallenge(detail) && (
            <section className="admin-challenge-termination-action">
              <span aria-hidden="true">
                <ReportProblemOutlinedIcon />
              </span>
              <div>
                <strong>관리자 도전 종료</strong>
                <small>
                  회원 요청 등 운영 사유로 도전을 종료합니다. 결제 환불은 결제
                  관리에서 별도로 처리해 주세요.
                </small>
              </div>
              <button
                disabled={terminating}
                onClick={() => onRequestTermination(detail)}
                ref={terminationTriggerRef}
                type="button"
              >
                관리자 종료
              </button>
            </section>
          )}

          <section className="admin-challenge-lifecycle">
            <header>
              <strong>참여·종료 기록</strong>
              <span>{lifecycleEvents.length}건</span>
            </header>
            {lifecycleEvents.length ? (
              <ol>
                {lifecycleEvents.map((event) => (
                  <li
                    className={`is-${event.eventType.toLowerCase()}`}
                    key={event.id}
                  >
                    <span
                      aria-hidden="true"
                      className="admin-challenge-lifecycle-marker"
                    />
                    <div>
                      <header>
                        <strong>{lifecycleEventLabel(event)}</strong>
                        <time dateTime={event.occurredAt}>
                          처리 {dateTimeText(event.occurredAt)}
                        </time>
                      </header>
                      <p>
                        {event.actor.name} ({actorRoleLabel(event.actorRole)})
                        {" · "}
                        {lifecycleSourceLabel(event.source)}
                      </p>
                      {event.consent && (
                        <dl>
                          <div>
                            <dt>동의 방법</dt>
                            <dd>{consentMethodLabel(event.consent.method)}</dd>
                          </div>
                          <div>
                            <dt>동의 시각</dt>
                            <dd>{dateTimeText(event.consent.consentedAt)}</dd>
                          </div>
                          <div>
                            <dt>규칙 버전</dt>
                            <dd>{event.consent.rulesVersion ?? "확인 필요"}</dd>
                          </div>
                          <div>
                            <dt>확정 기간</dt>
                            <dd>
                              {event.consent.startsAt &&
                              event.consent.endsAtExclusive
                                ? periodText(
                                    event.consent.startsAt,
                                    event.consent.endsAtExclusive,
                                  )
                                : "확인 필요"}
                            </dd>
                          </div>
                          {event.consent.evidence && (
                            <div>
                              <dt>동의 근거</dt>
                              <dd>{event.consent.evidence}</dd>
                            </div>
                          )}
                        </dl>
                      )}
                      {event.termination && (
                        <dl>
                          <div>
                            <dt>종료 구분</dt>
                            <dd>
                              {event.termination.kind === "WITHDRAWN"
                                ? "중도 포기"
                                : "참여 취소"}
                            </dd>
                          </div>
                          <div>
                            <dt>종료 사유</dt>
                            <dd>
                              {terminationReasonLabel(
                                event.termination.reasonCode,
                              )}
                            </dd>
                          </div>
                          {event.termination.reasonNote && (
                            <div>
                              <dt>관리 메모</dt>
                              <dd>{event.termination.reasonNote}</dd>
                            </div>
                          )}
                        </dl>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="admin-challenge-lifecycle-empty">
                표시할 참여·종료 기록이 없습니다. 감사 기록 도입 이전 도전일 수
                있습니다.
              </p>
            )}
          </section>

          {detail.currentWeekProgress && (
            <section className="admin-challenge-live-progress">
              <div>
                <span>현재 {detail.currentWeekProgress.weekNumber}주차</span>
                <strong>
                  {durationText(currentStudySeconds)} / {targetText(detailTarget)}
                </strong>
              </div>
              <progress
                aria-label={`${detail.currentWeekProgress.weekNumber}주차 공부시간 진행률`}
                max={Math.max(1, detailTarget)}
                value={Math.min(currentStudySeconds, Math.max(1, detailTarget))}
              />
              <small>
                {dateTimeText(detail.currentWeekProgress.countedThroughAt)} 기준
              </small>
            </section>
          )}

          <section className="admin-challenge-weeks">
            <header>
              <strong>주차별 현황</strong>
              <span>
                달성 {detail.weekSummary.passed} · 미달 {detail.weekSummary.failed}
                · 미진행 {displayedUnstartedWeekCount(detail)} · 대기{" "}
                {displayedPendingWeekCount(detail)}
              </span>
            </header>
            <div>
              {detail.weeks.map((week) => {
                const seconds = weekStudySeconds(detail, week);
                const current =
                  detail.currentWeekProgress?.weekNumber === week.weekNumber;
                const terminalPending =
                  week.status === "PENDING" &&
                  isTerminalChallengeStatus(detail.status);
                return (
                  <article
                    className={`${current ? "is-current " : ""}is-${week.status.toLowerCase()}${terminalPending ? " is-terminal-pending" : ""}`}
                    key={week.id}
                  >
                    <span className="admin-challenge-week-number">
                      {week.weekNumber}주차
                    </span>
                    <span className="admin-challenge-week-period">
                      {periodText(week.startsAt, week.endsAtExclusive)}
                    </span>
                    <strong>
                      {week.status === "SKIPPED" || terminalPending
                        ? "-"
                        : durationText(seconds)}
                    </strong>
                    <em>
                      {weekStatusLabel(
                        detail.status,
                        week,
                        detail.currentWeekNumber,
                      )}
                    </em>
                  </article>
                );
              })}
            </div>
          </section>

          <footer className="admin-challenge-detail-foot">
            상세 현황 {dateTimeText(detail.generatedAt)} 기준
          </footer>
        </>
      )}
    </article>
  );
}
