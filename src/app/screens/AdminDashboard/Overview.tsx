import { useMemo, useState, type ReactNode } from "react";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import CardGiftcardOutlinedIcon from "@mui/icons-material/CardGiftcardOutlined";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { AdminUser, NoticeRecord } from "../../../lib/types";
import type { AdminStats, AdminTabKey } from "./admin.types";
import {
  addCalendarMonthsDateOnly,
  addDaysDateOnly,
  formatDateInputForDisplay,
  membershipEndText,
  money,
  resolveEffectiveStartDateOnly,
  todayDateInputValue,
  toDateInputValue,
} from "./admin.utils";

type OverviewProps = {
  stats: AdminStats;
  users: AdminUser[];
  notices: NoticeRecord[];
  noticeTitle: string;
  noticeContent: string;
  manualUserId: string;
  manualMonths: number;
  manualName: string;
  manualPaidAt: string;
  manualStartDate: string;
  manualMemo: string;
  manualReceiptFile: File | null;
  savingManualPayment: boolean;
  freeTrialDays: number;
  freeTrialStartDate: string;
  freeTrialMemo: string;
  savingFreeTrial: boolean;
  onNoticeTitleChange: (value: string) => void;
  onNoticeContentChange: (value: string) => void;
  onManualUserChange: (value: string) => void;
  onManualMonthsChange: (value: number) => void;
  onManualNameChange: (value: string) => void;
  onManualPaidAtChange: (value: string) => void;
  onManualStartDateChange: (value: string) => void;
  onManualMemoChange: (value: string) => void;
  onManualReceiptChange: (file: File | null) => void;
  onFreeTrialDaysChange: (value: number) => void;
  onFreeTrialStartDateChange: (value: string) => void;
  onFreeTrialMemoChange: (value: string) => void;
  onSaveNotice: () => void;
  onSaveManualPayment: () => void;
  onSaveFreeTrial: () => void;
  onNavigate: (tab: AdminTabKey) => void;
};

const MANUAL_PAYMENT_PLANS = [
  { months: 1, amount: 370000 },
  { months: 2, amount: 700000 },
  { months: 3, amount: 990000 },
] as const;

const FREE_TRIAL_DAYS = [1, 3, 5, 7] as const;

type StatTone = "mint" | "gold" | "coral" | "navy";

const QUICK_ACTIONS: Array<{
  key: keyof AdminStats;
  label: string;
  countLabel: string;
  description: string;
  icon: ReactNode;
  tone: StatTone;
  target: AdminTabKey;
}> = [
  {
    key: "activeMembers",
    label: "회원 관리",
    countLabel: "활성 회원",
    description: "회원 정보와 이용권을 관리합니다.",
    icon: <GroupsOutlinedIcon />,
    tone: "mint",
    target: "members",
  },
  {
    key: "pendingConsultations",
    label: "상담 관리",
    countLabel: "상담 대기",
    description: "신규 상담을 확인하고 등록합니다.",
    icon: <AssignmentTurnedInOutlinedIcon />,
    tone: "gold",
    target: "consultations",
  },
  {
    key: "paid",
    label: "결제 관리",
    countLabel: "완료 결제",
    description: "결제 내역과 수동 결제를 관리합니다.",
    icon: <CreditCardOutlinedIcon />,
    tone: "coral",
    target: "payments",
  },
  {
    key: "unanswered",
    label: "1:1 문의",
    countLabel: "미답변 문의",
    description: "회원 문의에 답변합니다.",
    icon: <ChatBubbleOutlineOutlinedIcon />,
    tone: "navy",
    target: "chat",
  },
];

const NOTICES_PER_PAGE = 5;

export default function Overview(props: OverviewProps) {
  const {
    stats,
    users,
    notices,
    noticeTitle,
    noticeContent,
    manualUserId,
    manualMonths,
    manualName,
    manualPaidAt,
    manualStartDate,
    manualMemo,
    manualReceiptFile,
    savingManualPayment,
    freeTrialDays,
    freeTrialStartDate,
    freeTrialMemo,
    savingFreeTrial,
    onNoticeTitleChange,
    onNoticeContentChange,
    onManualUserChange,
    onManualMonthsChange,
    onManualNameChange,
    onManualPaidAtChange,
    onManualStartDateChange,
    onManualMemoChange,
    onManualReceiptChange,
    onFreeTrialDaysChange,
    onFreeTrialStartDateChange,
    onFreeTrialMemoChange,
    onSaveNotice,
    onSaveManualPayment,
    onSaveFreeTrial,
    onNavigate,
  } = props;

  const [manualUserSearch, setManualUserSearch] = useState("");
  const [actionMode, setActionMode] = useState<"payment" | "free">("payment");
  const [extendMode, setExtendMode] = useState<"new" | "extend" | "custom">(
    "new",
  );
  const [freeExtendMode, setFreeExtendMode] = useState<
    "new" | "extend" | "custom"
  >("new");
  const [pendingConfirm, setPendingConfirm] = useState<
    "payment" | "free" | null
  >(null);
  const [noticePage, setNoticePage] = useState(1);
  const totalNoticePages = Math.max(
    1,
    Math.ceil(notices.length / NOTICES_PER_PAGE),
  );
  const currentNoticePage = Math.min(noticePage, totalNoticePages);
  const pagedNotices = useMemo(() => {
    const start = (currentNoticePage - 1) * NOTICES_PER_PAGE;
    return notices.slice(start, start + NOTICES_PER_PAGE);
  }, [notices, currentNoticePage]);

  const manualUsers = useMemo(() => {
    const query = manualUserSearch.trim().toLowerCase();
    return users
      .filter((user) => user.role === "MEMBER")
      .filter((user) => {
        if (!query) return true;
        return [user.name, user.phone, user.examType, user.residenceArea]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      });
  }, [manualUserSearch, users]);
  const selectedManualUser = users.find((user) => user.id === manualUserId);
  const manualSelectUsers = useMemo(() => {
    if (!selectedManualUser) return manualUsers;
    if (manualUsers.some((user) => user.id === selectedManualUser.id)) {
      return manualUsers;
    }
    return [selectedManualUser, ...manualUsers];
  }, [manualUsers, selectedManualUser]);
  const currentMembershipEnd = selectedManualUser?.membershipEnd
    ? membershipEndText(selectedManualUser.membershipEnd)
    : null;
  const selectedManualPlan =
    MANUAL_PAYMENT_PLANS.find((plan) => plan.months === manualMonths) ??
    MANUAL_PAYMENT_PLANS[0];
  const selectedManualUserMeta = selectedManualUser
    ? [selectedManualUser.examType, selectedManualUser.phone]
        .filter(Boolean)
        .join(" · ")
    : "";
  const existingStartValue = toDateInputValue(
    selectedManualUser?.membershipEnd,
  );
  const effectiveManualStart = resolveEffectiveStartDateOnly(
    manualStartDate,
    selectedManualUser?.membershipEnd,
  );
  const manualStartWillAutoAdjust =
    Boolean(manualStartDate) && effectiveManualStart !== manualStartDate;
  const effectiveFreeTrialStart = resolveEffectiveStartDateOnly(
    freeTrialStartDate,
    selectedManualUser?.membershipEnd,
  );
  const freeStartWillAutoAdjust =
    Boolean(freeTrialStartDate) &&
    effectiveFreeTrialStart !== freeTrialStartDate;
  const projectedMembershipEnd = useMemo(() => {
    const periodEnd = addCalendarMonthsDateOnly(
      effectiveManualStart,
      manualMonths,
    );
    const visibleEnd = periodEnd ? addDaysDateOnly(periodEnd, -1) : null;
    return visibleEnd ? formatDateInputForDisplay(visibleEnd) : null;
  }, [effectiveManualStart, manualMonths]);

  function selectExtendMode(mode: "new" | "extend" | "custom") {
    setExtendMode(mode);
    if (mode === "new") onManualStartDateChange(todayDateInputValue());
    if (mode === "extend" && existingStartValue) {
      onManualStartDateChange(existingStartValue);
    }
  }

  const projectedFreeTrialEnd = useMemo(() => {
    const periodEnd = addDaysDateOnly(effectiveFreeTrialStart, freeTrialDays);
    const visibleEnd = periodEnd ? addDaysDateOnly(periodEnd, -1) : null;
    return visibleEnd ? formatDateInputForDisplay(visibleEnd) : null;
  }, [effectiveFreeTrialStart, freeTrialDays]);

  function selectFreeExtendMode(mode: "new" | "extend" | "custom") {
    setFreeExtendMode(mode);
    if (mode === "new") onFreeTrialStartDateChange(todayDateInputValue());
    if (mode === "extend" && existingStartValue) {
      onFreeTrialStartDateChange(existingStartValue);
    }
  }

  function selectManualUser(userId: string) {
    onManualUserChange(userId);
    setExtendMode("new");
    setFreeExtendMode("new");
    const today = todayDateInputValue();
    onManualStartDateChange(today);
    onFreeTrialStartDateChange(today);
  }

  const manualActionDisabled =
    savingManualPayment ||
    !selectedManualUser ||
    !manualName.trim() ||
    !manualPaidAt ||
    !manualStartDate;
  const freeActionDisabled =
    savingFreeTrial || !selectedManualUser || !freeTrialStartDate;
  const manualStartHelp =
    extendMode === "extend"
      ? "기존 종료일 다음날부터 이어서 계산됩니다."
      : currentMembershipEnd
        ? "남은 기간이 있으면 기존 종료일 다음날부터 자동으로 이어집니다."
        : "선택한 날짜부터 이용권 기간을 계산합니다.";
  const freeStartHelp =
    freeExtendMode === "extend"
      ? "기존 종료일 다음날부터 무료 기간이 이어집니다."
      : currentMembershipEnd
        ? "남은 기간이 있으면 기존 종료일 다음날부터 자동으로 이어집니다."
        : "선택한 날짜부터 무료 기간을 계산합니다.";
  const confirmRows: Array<[string, string | null]> =
    pendingConfirm === "payment"
      ? [
          ["회원", selectedManualUser?.name ?? "-"],
          [
            "이용권",
            `${selectedManualPlan.months}개월 · ${money(selectedManualPlan.amount)}`,
          ],
          ["입금자명", manualName.trim() || "-"],
          ["입금일", formatDateInputForDisplay(manualPaidAt)],
          [
            manualStartWillAutoAdjust
              ? "적용 기준일 (자동 조정됨)"
              : "적용 기준일",
            formatDateInputForDisplay(effectiveManualStart),
          ],
          ["만료 예정일", projectedMembershipEnd],
        ]
      : [
          ["회원", selectedManualUser?.name ?? "-"],
          ["무료 기간", `${freeTrialDays}일`],
          [
            freeStartWillAutoAdjust
              ? "적용 기준일 (자동 조정됨)"
              : "적용 기준일",
            formatDateInputForDisplay(effectiveFreeTrialStart),
          ],
          ["만료 예정일", projectedFreeTrialEnd],
        ];

  function confirmPendingAction() {
    const action = pendingConfirm;
    setPendingConfirm(null);
    if (action === "payment") onSaveManualPayment();
    if (action === "free") onSaveFreeTrial();
  }

  return (
    <section className="admin-dashboard-home admin-overview">
      <nav className="admin-overview-quick-actions" aria-label="주요 관리 메뉴">
        {QUICK_ACTIONS.map((action) => (
          <button
            type="button"
            className={`admin-overview-quick-action is-${action.tone}`}
            key={action.target}
            onClick={() => onNavigate(action.target)}
          >
            <span className="admin-overview-quick-action-icon">{action.icon}</span>
            <span className="admin-overview-quick-action-copy">
              <strong>{action.label}</strong>
              <small>{action.description}</small>
            </span>
            <span className="admin-overview-quick-action-stat">
              <small>{action.countLabel}</small>
              <strong>{stats[action.key]}</strong>
            </span>
            <ChevronRightIcon aria-hidden="true" />
          </button>
        ))}
      </nav>

      <div className="admin-overview-workspace">
        <section className="admin-card admin-overview-notice">
          <h2>
            <AdminPanelSettingsOutlinedIcon /> 공지 작성
          </h2>
          <div className="admin-overview-notice-form">
            <label>
              <span>제목</span>
              <input
                value={noticeTitle}
                onChange={(event) =>
                  onNoticeTitleChange(event.target.value.slice(0, 50))
                }
                placeholder="공지 제목을 입력하세요 (최대 50자)"
                maxLength={50}
              />
              <small className="admin-char-count">
                {noticeTitle.length}/50
              </small>
            </label>
            <label>
              <span>내용</span>
              <textarea
                value={noticeContent}
                onChange={(event) =>
                  onNoticeContentChange(event.target.value.slice(0, 300))
                }
                placeholder="공지 내용을 입력하세요 (최대 300자)"
                maxLength={300}
              />
              <small className="admin-char-count">
                {noticeContent.length}/300
              </small>
            </label>
            <button onClick={onSaveNotice} type="button">
              공지 등록
            </button>
          </div>

          <div className="admin-recent-notices">
            <div className="admin-recent-notices-head">
              <h3>최근 공지</h3>
            </div>

            {pagedNotices.length === 0 ? (
              <p className="admin-recent-notices-empty">
                등록된 공지가 없습니다.
              </p>
            ) : (
              <ul>
                {pagedNotices.map((notice) => (
                  <li key={notice.id}>
                    <span
                      className={
                        notice.level === "IMPORTANT"
                          ? "admin-notice-tag is-important"
                          : "admin-notice-tag"
                      }
                    >
                      {notice.level === "IMPORTANT" ? "필독" : "공지"}
                    </span>
                    <div>
                      <strong>{notice.title}</strong>
                      <em>{formatDateInputForDisplay(notice.createdAt)}</em>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {totalNoticePages > 1 && (
              <div className="admin-recent-notices-pager">
                <button
                  disabled={currentNoticePage <= 1}
                  onClick={() => setNoticePage(currentNoticePage - 1)}
                  type="button"
                  aria-label="이전 공지"
                >
                  <ChevronLeftIcon />
                </button>
                <span>
                  {currentNoticePage}/{totalNoticePages}
                </span>
                <button
                  disabled={currentNoticePage >= totalNoticePages}
                  onClick={() => setNoticePage(currentNoticePage + 1)}
                  type="button"
                  aria-label="다음 공지"
                >
                  <ChevronRightIcon />
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="admin-card admin-overview-access">
          <div className="admin-overview-access-head">
            <h2>
              <CreditCardOutlinedIcon /> 이용권 처리
            </h2>
            <div className="admin-overview-action-tabs" role="tablist">
              <button
                aria-selected={actionMode === "payment"}
                className={actionMode === "payment" ? "is-active" : ""}
                onClick={() => setActionMode("payment")}
                role="tab"
                type="button"
              >
                <CreditCardOutlinedIcon />
                수동 결제
              </button>
              <button
                aria-selected={actionMode === "free"}
                className={actionMode === "free" ? "is-active" : ""}
                onClick={() => setActionMode("free")}
                role="tab"
                type="button"
              >
                <CardGiftcardOutlinedIcon />
                무료 기간
              </button>
            </div>
          </div>

          <div className="admin-overview-member-picker">
            <label className="admin-overview-field">
              <span>회원 검색</span>
              <input
                value={manualUserSearch}
                onChange={(event) => setManualUserSearch(event.target.value)}
                placeholder="이름, 연락처, 자격증, 지역 검색"
              />
            </label>
            <label className="admin-overview-field">
              <span>선택 회원</span>
              <select
                value={manualUserId}
                onChange={(event) => selectManualUser(event.target.value)}
              >
                <option value="">회원을 선택하세요</option>
                {manualSelectUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.id === selectedManualUser?.id &&
                    !manualUsers.some((item) => item.id === user.id)
                      ? `현재 선택 · ${user.name}`
                      : user.name}
                  </option>
                ))}
              </select>
              {manualSelectUsers.length === 0 && (
                <small className="admin-overview-field-note">
                  검색 결과와 일치하는 회원이 없습니다.
                </small>
              )}
            </label>
          </div>

          <div className="admin-overview-access-layout">
            <div className="admin-overview-access-form">
              {actionMode === "payment" ? (
                <>
                  <div className="admin-access-section">
                    <h3>결제 정보</h3>
                    <div className="admin-overview-plan-options">
                      {MANUAL_PAYMENT_PLANS.map((plan) => (
                        <button
                          aria-pressed={manualMonths === plan.months}
                          className={
                            manualMonths === plan.months ? "is-active" : ""
                          }
                          key={plan.months}
                          onClick={() => onManualMonthsChange(plan.months)}
                          type="button"
                        >
                          <span>{plan.months}개월</span>
                          <strong>{money(plan.amount)}</strong>
                          <small>
                            월 {money(Math.round(plan.amount / plan.months))}
                          </small>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="admin-access-section">
                    <h3>입금 정보</h3>
                    <div className="admin-access-form-grid is-three">
                      <label className="admin-overview-field">
                        <span>입금자명</span>
                        <input
                          value={manualName}
                          onChange={(event) =>
                            onManualNameChange(event.target.value)
                          }
                          placeholder="예: 홍길동"
                        />
                      </label>
                      <label className="admin-overview-field">
                        <span>입금일</span>
                        <input
                          type="date"
                          value={manualPaidAt}
                          onChange={(event) =>
                            onManualPaidAtChange(event.target.value)
                          }
                        />
                      </label>
                      <label className="admin-overview-field">
                        <span>
                          {extendMode === "custom"
                            ? "멤버십 시작일"
                            : "적용 기준일"}
                        </span>
                        <input
                          type="date"
                          value={manualStartDate}
                          disabled={extendMode !== "custom"}
                          onChange={(event) =>
                            onManualStartDateChange(event.target.value)
                          }
                        />
                        <small>{manualStartHelp}</small>
                      </label>
                    </div>
                  </div>

                  <div className="admin-access-section">
                    <h3>연장 여부</h3>
                    <div className="admin-extend-mode" role="radiogroup">
                      <label>
                        <input
                          type="radio"
                          name="manual-extend-mode"
                          checked={extendMode === "new"}
                          onChange={() => selectExtendMode("new")}
                        />
                        <span>신규 결제</span>
                      </label>
                      <label
                        className={!existingStartValue ? "is-disabled" : ""}
                      >
                        <input
                          type="radio"
                          name="manual-extend-mode"
                          disabled={!existingStartValue}
                          checked={extendMode === "extend"}
                          onChange={() => selectExtendMode("extend")}
                        />
                        <span>기존 멤버십 연장</span>
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="manual-extend-mode"
                          checked={extendMode === "custom"}
                          onChange={() => selectExtendMode("custom")}
                        />
                        <span>직접 선택</span>
                      </label>
                    </div>
                    {manualStartWillAutoAdjust && (
                      <p className="admin-extend-auto-note">
                        선택한 날짜({formatDateInputForDisplay(manualStartDate)}
                        ) 보다 기존 이용권이 이후까지 남아있어 실제 적용
                        시작일은{" "}
                        <strong>
                          {formatDateInputForDisplay(effectiveManualStart)}
                        </strong>
                        로 자동 조정됩니다.
                      </p>
                    )}
                    <dl className="admin-overview-period-preview">
                      <div>
                        <dt>기존 종료일</dt>
                        <dd>{currentMembershipEnd ?? "이용권 없음"}</dd>
                      </div>
                      <div>
                        <dt>실제 시작일</dt>
                        <dd>
                          {formatDateInputForDisplay(effectiveManualStart) ||
                            "-"}
                        </dd>
                      </div>
                      <div>
                        <dt>만료 예정일</dt>
                        <dd>{projectedMembershipEnd ?? "-"}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="admin-access-section admin-evidence-section">
                    <h3>메모 및 증빙</h3>
                    <div className="admin-access-form-grid is-two">
                      <textarea
                        className="admin-overview-memo"
                        value={manualMemo}
                        onChange={(event) =>
                          onManualMemoChange(event.target.value)
                        }
                        placeholder="관리자 메모 (선택)"
                      />
                      <label className="admin-overview-upload">
                        <UploadFileOutlinedIcon />
                        <span>입금 확인 사진</span>
                        <strong>
                          {manualReceiptFile?.name ?? "사진 선택"}
                        </strong>
                        <small>JPG, PNG, WEBP</small>
                        <input
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) =>
                            onManualReceiptChange(
                              event.target.files?.[0] ?? null,
                            )
                          }
                          type="file"
                        />
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="admin-access-section">
                    <h3>무료 기간 정보</h3>
                    <div className="admin-overview-free-options">
                      {FREE_TRIAL_DAYS.map((days) => (
                        <button
                          aria-pressed={freeTrialDays === days}
                          className={freeTrialDays === days ? "is-active" : ""}
                          key={days}
                          onClick={() => onFreeTrialDaysChange(days)}
                          type="button"
                        >
                          {days}일
                        </button>
                      ))}
                    </div>
                    <div className="admin-access-form-grid is-two">
                      <label className="admin-overview-field">
                        <span>
                          {freeExtendMode === "custom"
                            ? "무료 시작일"
                            : "적용 기준일"}
                        </span>
                        <input
                          type="date"
                          value={freeTrialStartDate}
                          disabled={freeExtendMode !== "custom"}
                          onChange={(event) =>
                            onFreeTrialStartDateChange(event.target.value)
                          }
                        />
                        <small>{freeStartHelp}</small>
                      </label>
                    </div>
                  </div>

                  <div className="admin-free-period-note">
                    <CardGiftcardOutlinedIcon />
                    <strong>{freeTrialDays}일 무료 기간</strong>
                    <span>결제 내역 없이 학습 이용권만 연장합니다.</span>
                  </div>

                  <div className="admin-access-section">
                    <h3>연장 여부</h3>
                    <div className="admin-extend-mode" role="radiogroup">
                      <label>
                        <input
                          type="radio"
                          name="free-extend-mode"
                          checked={freeExtendMode === "new"}
                          onChange={() => selectFreeExtendMode("new")}
                        />
                        <span>신규 적용</span>
                      </label>
                      <label
                        className={!existingStartValue ? "is-disabled" : ""}
                      >
                        <input
                          type="radio"
                          name="free-extend-mode"
                          disabled={!existingStartValue}
                          checked={freeExtendMode === "extend"}
                          onChange={() => selectFreeExtendMode("extend")}
                        />
                        <span>기존 멤버십 연장</span>
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="free-extend-mode"
                          checked={freeExtendMode === "custom"}
                          onChange={() => selectFreeExtendMode("custom")}
                        />
                        <span>직접 선택</span>
                      </label>
                    </div>
                    {freeStartWillAutoAdjust && (
                      <p className="admin-extend-auto-note">
                        선택한 날짜(
                        {formatDateInputForDisplay(freeTrialStartDate)}) 보다
                        기존 이용권이 이후까지 남아있어 실제 적용 시작일은{" "}
                        <strong>
                          {formatDateInputForDisplay(effectiveFreeTrialStart)}
                        </strong>
                        로 자동 조정됩니다.
                      </p>
                    )}
                    <dl className="admin-overview-period-preview">
                      <div>
                        <dt>기존 종료일</dt>
                        <dd>{currentMembershipEnd ?? "이용권 없음"}</dd>
                      </div>
                      <div>
                        <dt>실제 시작일</dt>
                        <dd>
                          {formatDateInputForDisplay(effectiveFreeTrialStart) ||
                            "-"}
                        </dd>
                      </div>
                      <div>
                        <dt>만료 예정일</dt>
                        <dd>{projectedFreeTrialEnd ?? "-"}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="admin-access-section admin-evidence-section">
                    <h3>관리자 메모</h3>
                    <textarea
                      className="admin-overview-memo"
                      value={freeTrialMemo}
                      onChange={(event) =>
                        onFreeTrialMemoChange(event.target.value)
                      }
                      placeholder="관리자 메모 (예: 첫 런칭 7일 제공, 병원 결석 보상)"
                    />
                  </div>
                </>
              )}
            </div>

            <aside className="admin-overview-summary">
              <div className="admin-overview-summary-member">
                <span>선택 회원</span>
                <strong>
                  {selectedManualUser?.name ?? "회원을 선택하세요"}
                </strong>
                {selectedManualUserMeta && <p>{selectedManualUserMeta}</p>}
                <em>
                  {currentMembershipEnd
                    ? `기존 종료일 ${currentMembershipEnd}`
                    : "현재 이용권 없음"}
                </em>
              </div>

              {actionMode === "payment" ? (
                <dl className="admin-overview-summary-list">
                  <div>
                    <dt>선택 이용권</dt>
                    <dd>{selectedManualPlan.months}개월권</dd>
                  </div>
                  <div className="is-emphasis">
                    <dt>결제 금액</dt>
                    <dd>{money(selectedManualPlan.amount)}</dd>
                  </div>
                  <div>
                    <dt>입금일</dt>
                    <dd>{formatDateInputForDisplay(manualPaidAt) || "-"}</dd>
                  </div>
                  <div>
                    <dt>실제 시작일</dt>
                    <dd>
                      {formatDateInputForDisplay(effectiveManualStart) || "-"}
                    </dd>
                  </div>
                  <div>
                    <dt>만료 예정일</dt>
                    <dd>{projectedMembershipEnd ?? "-"}</dd>
                  </div>
                </dl>
              ) : (
                <dl className="admin-overview-summary-list">
                  <div className="is-emphasis">
                    <dt>무료 기간</dt>
                    <dd>{freeTrialDays}일</dd>
                  </div>
                  <div>
                    <dt>실제 시작일</dt>
                    <dd>
                      {formatDateInputForDisplay(effectiveFreeTrialStart) ||
                        "-"}
                    </dd>
                  </div>
                  <div>
                    <dt>만료 예정일</dt>
                    <dd>{projectedFreeTrialEnd ?? "-"}</dd>
                  </div>
                </dl>
              )}

              {actionMode === "payment" && (
                <p className="admin-overview-receipt-status">
                  <UploadFileOutlinedIcon />
                  {manualReceiptFile
                    ? "입금 확인 사진 선택됨"
                    : "입금 확인 사진은 선택 사항입니다"}
                </p>
              )}

              <button
                className="admin-overview-submit"
                disabled={
                  actionMode === "payment"
                    ? manualActionDisabled
                    : freeActionDisabled
                }
                onClick={() => setPendingConfirm(actionMode)}
                type="button"
              >
                {actionMode === "payment"
                  ? savingManualPayment
                    ? "등록중"
                    : "수동 결제 등록"
                  : savingFreeTrial
                    ? "추가중"
                    : "무료 기간 추가"}
              </button>
              <small className="admin-overview-submit-note">
                등록 전 확인창에서 적용 내용을 다시 확인합니다.
              </small>
            </aside>
          </div>
        </section>
      </div>

      {pendingConfirm && (
        <div
          className="admin-confirm-backdrop"
          onClick={() => setPendingConfirm(null)}
          role="presentation"
        >
          <div
            aria-labelledby="admin-confirm-title"
            aria-modal="true"
            className="admin-confirm-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <strong id="admin-confirm-title">
              {pendingConfirm === "payment"
                ? "수동 결제를 등록할까요?"
                : "무료 기간을 추가할까요?"}
            </strong>
            <p>
              등록 후 회원 이용권 기간이 바로 변경됩니다. 아래 내용을 한 번 더
              확인해 주세요.
            </p>
            <dl>
              {confirmRows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "-"}</dd>
                </div>
              ))}
            </dl>
            <div className="admin-confirm-actions">
              <button onClick={() => setPendingConfirm(null)} type="button">
                취소
              </button>
              <button onClick={confirmPendingAction} type="button">
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
