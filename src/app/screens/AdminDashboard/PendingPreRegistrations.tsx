import { useCallback, useEffect, useRef, useState } from "react";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import type { AdminUser, AdminUsersResult, Branch } from "../../../lib/types";
import { getAdminPreRegistrations } from "../../services/admin.service";
import AdminPager from "./AdminPager";

const PAGE_LIMIT = 8;

const EMPTY_RESULT: AdminUsersResult = {
  list: [],
  total: 0,
  page: 1,
  limit: PAGE_LIMIT,
  totalPages: 1,
};

const createdDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function branchLabel(user: AdminUser, branches: Branch[]) {
  return (
    user.branch?.name ??
    branches.find((branch) => branch.id === user.branchId)?.name ??
    "지점 없음"
  );
}

function createdDate(value?: string) {
  if (!value) return "날짜 없음";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "날짜 없음"
    : createdDateFormatter.format(date);
}

export default function PendingPreRegistrations({
  branches,
}: {
  branches: Branch[];
}) {
  const [result, setResult] = useState<AdminUsersResult>(EMPTY_RESULT);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchText, setSearchText] = useState("");
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearchText(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    try {
      const response = await getAdminPreRegistrations({
        page,
        limit: PAGE_LIMIT,
        branchId: branchId || undefined,
        text: searchText || undefined,
      });
      if (requestId !== requestIdRef.current) return;
      if (response.page > response.totalPages) {
        setPage(response.totalPages);
        return;
      }
      setResult(response);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "사전등록 대기 목록을 불러오지 못했습니다.",
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [branchId, page, searchText]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [load]);

  useEffect(() => {
    const refreshOnFocus = () => void load();
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [load]);

  function changeBranch(nextBranchId: string) {
    setPage(1);
    setBranchId(nextBranchId);
  }

  return (
    <div className="admin-pending-pre-registrations">
      <div className="admin-pending-pre-registrations-toolbar">
        <label>
          <span>대기 회원 검색</span>
          <input
            maxLength={80}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="이름, 연락처, 자격증, 지역"
            value={searchInput}
          />
        </label>
        <label>
          <span>지점</span>
          <select
            onChange={(event) => changeBranch(event.target.value)}
            value={branchId}
          >
            <option value="">전체 지점</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <button disabled={loading} onClick={() => void load()} type="button">
          <RefreshOutlinedIcon />
          새로고침
        </button>
      </div>

      <div className="admin-pending-pre-registrations-summary">
        <strong>{result.total}명</strong>
        <span>가입을 완료하면 다음 조회에서 자동으로 제외됩니다.</span>
      </div>

      {error && (
        <p className="admin-pending-pre-registrations-error" role="alert">
          {error}
        </p>
      )}

      <div
        aria-busy={loading}
        className="admin-pending-pre-registrations-list"
        role="list"
      >
        {loading && result.list.length === 0 ? (
          <p className="admin-pending-pre-registrations-empty">
            대기 목록을 불러오는 중입니다.
          </p>
        ) : result.list.length === 0 ? (
          <p className="admin-pending-pre-registrations-empty">
            조건에 맞는 사전등록 대기 회원이 없습니다.
          </p>
        ) : (
          result.list.map((user) => (
            <article key={user.id} role="listitem">
              <span aria-hidden="true" className="admin-pending-pre-avatar">
                {user.name.slice(0, 1)}
              </span>
              <div className="admin-pending-pre-identity">
                <strong>{user.name}</strong>
                <small>{branchLabel(user, branches)}</small>
              </div>
              <em>가입 대기</em>
              <dl>
                <div>
                  <dt>연락처</dt>
                  <dd>{user.phone ?? "미입력"}</dd>
                </div>
                <div>
                  <dt>준비 정보</dt>
                  <dd>
                    {[user.examType, user.prepDuration]
                      .filter(Boolean)
                      .join(" · ") || "미입력"}
                  </dd>
                </div>
                <div>
                  <dt>사전등록일</dt>
                  <dd>{createdDate(user.createdAt)}</dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </div>

      <AdminPager meta={result} numbered onPageChange={setPage} />
    </div>
  );
}
