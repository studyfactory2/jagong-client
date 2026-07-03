import { useMemo, useState, type ReactNode } from "react";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CardGiftcardOutlinedIcon from "@mui/icons-material/CardGiftcardOutlined";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { AdminUser, NoticeRecord } from "../../../lib/types";
import type { AdminStats } from "./admin.types";
import { membershipEndText, money } from "./admin.utils";

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
};

const MANUAL_PAYMENT_PLANS = [
  { months: 1, amount: 370000 },
  { months: 2, amount: 700000 },
  { months: 3, amount: 990000 },
] as const;

const FREE_TRIAL_DAYS = [1, 3, 5, 7] as const;

type StatTone = "mint" | "gold" | "coral" | "navy";

const STAT_ITEMS: Array<{
  key: keyof AdminStats;
  label: string;
  icon: ReactNode;
  tone: StatTone;
}> = [
  {
    key: "activeMembers",
    label: "활성 회원",
    icon: <GroupsOutlinedIcon />,
    tone: "mint",
  },
  {
    key: "pendingConsultations",
    label: "상담 대기",
    icon: <AssignmentTurnedInOutlinedIcon />,
    tone: "gold",
  },
  {
    key: "paid",
    label: "완료 결제",
    icon: <CreditCardOutlinedIcon />,
    tone: "coral",
  },
  {
    key: "pendingLeaves",
    label: "휴가 대기",
    icon: <CalendarMonthOutlinedIcon />,
    tone: "navy",
  },
  {
    key: "unanswered",
    label: "미답변 문의",
    icon: <ChatBubbleOutlineOutlinedIcon />,
    tone: "mint",
  },
  {
    key: "working",
    label: "캠 입장",
    icon: <VideocamOutlinedIcon />,
    tone: "gold",
  },
];

const NOTICES_PER_PAGE = 5;

function shortDateText(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function toDateInputValue(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayInputValue(): string {
  return toDateInputValue(new Date().toISOString());
}

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
  } = props;

  const [manualUserSearch, setManualUserSearch] = useState("");
  const [actionMode, setActionMode] = useState<"payment" | "free">("payment");
  const [extendMode, setExtendMode] = useState<"new" | "extend" | "custom">(
    "new",
  );
  const [freeExtendMode, setFreeExtendMode] = useState<
    "new" | "extend" | "custom"
  >("new");
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
  const projectedMembershipEnd = useMemo(() => {
    if (!manualStartDate) return null;
    const start = new Date(manualStartDate);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start);
    end.setMonth(end.getMonth() + manualMonths);
    return shortDateText(end.toISOString());
  }, [manualStartDate, manualMonths]);

  function selectExtendMode(mode: "new" | "extend" | "custom") {
    setExtendMode(mode);
    if (mode === "new") onManualStartDateChange(todayInputValue());
    if (mode === "extend" && existingStartValue) {
      onManualStartDateChange(existingStartValue);
    }
  }

  const projectedFreeTrialEnd = useMemo(() => {
    if (!freeTrialStartDate) return null;
    const start = new Date(freeTrialStartDate);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start);
    end.setDate(end.getDate() + freeTrialDays);
    return shortDateText(end.toISOString());
  }, [freeTrialStartDate, freeTrialDays]);

  function selectFreeExtendMode(mode: "new" | "extend" | "custom") {
    setFreeExtendMode(mode);
    if (mode === "new") onFreeTrialStartDateChange(todayInputValue());
    if (mode === "extend" && existingStartValue) {
      onFreeTrialStartDateChange(existingStartValue);
    }
  }

  // Reset the extend-mode selection whenever a different member is chosen,
  // so a stale "기존 멤버십 연장" choice from a previous member never lingers.
  const [lastManualUserId, setLastManualUserId] = useState(manualUserId);
  if (manualUserId !== lastManualUserId) {
    setLastManualUserId(manualUserId);
    setExtendMode("new");
    setFreeExtendMode("new");
  }

  return (
    <section className="admin-dashboard-home">
      <div className="admin-dashboard-metrics">
        {STAT_ITEMS.map((item) => (
          <article className={`admin-stat is-${item.tone}`} key={item.key}>
            <span className="admin-stat-icon">{item.icon}</span>
            <span>{item.label}</span>
            <strong>{stats[item.key]}</strong>
          </article>
        ))}
      </div>

      <div className="admin-dashboard-main">
        <section className="admin-card admin-notice-card admin-compact-notice">
          <h2>
            <AdminPanelSettingsOutlinedIcon /> 공지 작성
          </h2>
          <div className="admin-notice-fields">
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
                      <em>{shortDateText(notice.createdAt)}</em>
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

        <section className="admin-card admin-manual-payment-card admin-access-card">
          <div className="admin-access-head">
            <h2>
              <CreditCardOutlinedIcon /> 이용권 처리
            </h2>
            <div className="admin-membership-action-tabs" role="tablist">
              <button
                className={actionMode === "payment" ? "is-active" : ""}
                onClick={() => setActionMode("payment")}
                type="button"
              >
                <CreditCardOutlinedIcon />
                수동 결제
              </button>
              <button
                className={actionMode === "free" ? "is-active" : ""}
                onClick={() => setActionMode("free")}
                type="button"
              >
                <CardGiftcardOutlinedIcon />
                무료 기간
              </button>
            </div>
          </div>

          <div className="admin-access-search-row">
            <label className="admin-search">
              <span>회원 검색</span>
              <input
                value={manualUserSearch}
                onChange={(event) => setManualUserSearch(event.target.value)}
                placeholder="이름, 연락처, 자격증, 지역 검색"
              />
            </label>
            <label className="admin-payment-field">
              <span>선택 회원</span>
              <select
                value={manualUserId}
                onChange={(event) => onManualUserChange(event.target.value)}
              >
                {manualUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-selected-member">
            <div>
              <span>선택된 회원</span>
              <strong>{selectedManualUser?.name ?? "회원을 선택하세요"}</strong>
              {selectedManualUserMeta && <p>{selectedManualUserMeta}</p>}
            </div>
            {currentMembershipEnd && (
              <em>기존 종료일 {currentMembershipEnd}</em>
            )}
          </div>

          {actionMode === "payment" ? (
            <>
              <div className="admin-access-section">
                <h3>결제 정보</h3>
                <div className="admin-access-form-grid is-two">
                  <label className="admin-payment-field">
                    <span>상품/플랜</span>
                    <select
                      value={manualMonths}
                      onChange={(event) =>
                        onManualMonthsChange(Number(event.target.value))
                      }
                    >
                      {MANUAL_PAYMENT_PLANS.map((plan) => (
                        <option key={plan.months} value={plan.months}>
                          {plan.months}개월 이용권
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-payment-field">
                    <span>결제 금액</span>
                    <select disabled value={selectedManualPlan.amount}>
                      {MANUAL_PAYMENT_PLANS.map((plan) => (
                        <option key={plan.amount} value={plan.amount}>
                          {money(plan.amount)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="admin-access-section">
                <h3>입금 정보</h3>
                <div className="admin-access-form-grid is-three">
                  <label className="admin-payment-field">
                    <span>입금자명</span>
                    <input
                      value={manualName}
                      onChange={(event) =>
                        onManualNameChange(event.target.value)
                      }
                      placeholder="예: 홍길동"
                    />
                  </label>
                  <label className="admin-payment-field">
                    <span>입금일</span>
                    <input
                      type="date"
                      value={manualPaidAt}
                      onChange={(event) =>
                        onManualPaidAtChange(event.target.value)
                      }
                    />
                  </label>
                  <label className="admin-payment-field">
                    <span>멤버십 시작일</span>
                    <input
                      type="date"
                      value={manualStartDate}
                      disabled={extendMode !== "custom"}
                      onChange={(event) =>
                        onManualStartDateChange(event.target.value)
                      }
                    />
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
                  <label className={!existingStartValue ? "is-disabled" : ""}>
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
                {projectedMembershipEnd && (
                  <p className="admin-extend-preview">
                    멤버십 만료 예정일 <strong>{projectedMembershipEnd}</strong>
                  </p>
                )}
              </div>

              <div className="admin-access-section admin-evidence-section">
                <h3>메모 및 증빙</h3>
                <div className="admin-access-form-grid is-two">
                  <textarea
                    value={manualMemo}
                    onChange={(event) => onManualMemoChange(event.target.value)}
                    placeholder="관리자 메모 (선택)"
                  />
                  <label className="admin-payment-upload">
                    <span>입금 확인 사진</span>
                    <strong>{manualReceiptFile?.name ?? "사진 선택"}</strong>
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) =>
                        onManualReceiptChange(event.target.files?.[0] ?? null)
                      }
                      type="file"
                    />
                  </label>
                </div>
              </div>

              <div className="admin-form-actions">
                <button
                  disabled={savingManualPayment}
                  onClick={onSaveManualPayment}
                  type="button"
                >
                  {savingManualPayment ? "등록중" : "수동 결제 등록"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="admin-access-section">
                <h3>무료 기간 정보</h3>
                <div className="admin-access-form-grid is-two">
                  <label className="admin-payment-field">
                    <span>무료 기간</span>
                    <select
                      value={freeTrialDays}
                      onChange={(event) =>
                        onFreeTrialDaysChange(Number(event.target.value))
                      }
                    >
                      {FREE_TRIAL_DAYS.map((days) => (
                        <option key={days} value={days}>
                          {days}일
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-payment-field">
                    <span>적용 시작일</span>
                    <input
                      type="date"
                      value={freeTrialStartDate}
                      disabled={freeExtendMode !== "custom"}
                      onChange={(event) =>
                        onFreeTrialStartDateChange(event.target.value)
                      }
                    />
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
                  <label className={!existingStartValue ? "is-disabled" : ""}>
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
                {projectedFreeTrialEnd && (
                  <p className="admin-extend-preview">
                    멤버십 만료 예정일 <strong>{projectedFreeTrialEnd}</strong>
                  </p>
                )}
              </div>

              <div className="admin-access-section admin-evidence-section">
                <h3>관리자 메모</h3>
                <textarea
                  value={freeTrialMemo}
                  onChange={(event) =>
                    onFreeTrialMemoChange(event.target.value)
                  }
                  placeholder="관리자 메모 (예: 첫 런칭 7일 제공, 병원 결석 보상)"
                />
              </div>

              <div className="admin-form-actions">
                <button
                  disabled={savingFreeTrial}
                  onClick={onSaveFreeTrial}
                  type="button"
                >
                  {savingFreeTrial ? "추가중" : "무료 기간 추가"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
