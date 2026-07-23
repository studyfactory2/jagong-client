import type { PageMeta } from "../../../lib/types";

type AdminPagerProps = {
  meta: PageMeta;
  onPageChange: (page: number) => void;
  numbered?: boolean;
};

function visiblePages(page: number, totalPages: number) {
  const windowSize = Math.min(5, totalPages);
  const start = Math.min(
    Math.max(1, page - Math.floor(windowSize / 2)),
    Math.max(1, totalPages - windowSize + 1),
  );

  return Array.from({ length: windowSize }, (_, index) => start + index);
}

export default function AdminPager({
  meta,
  onPageChange,
  numbered = false,
}: AdminPagerProps) {
  if (meta.totalPages <= 1) return null;

  const previous = Math.max(1, meta.page - 1);
  const next = Math.min(meta.totalPages, meta.page + 1);
  const pages = visiblePages(meta.page, meta.totalPages);

  return (
    <nav className="admin-list-pager" aria-label="목록 페이지">
      <button
        aria-label="이전 페이지"
        disabled={meta.page <= 1}
        onClick={() => onPageChange(previous)}
        type="button"
      >
        이전
      </button>
      {numbered ? (
        <>
          <span className="admin-list-pager-pages">
            {pages.map((page) => (
              <button
                aria-current={page === meta.page ? "page" : undefined}
                className={page === meta.page ? "is-current" : ""}
                key={page}
                onClick={() => onPageChange(page)}
                type="button"
              >
                {page}
              </button>
            ))}
          </span>
          <span className="admin-list-pager-summary">
            {meta.page} / {meta.totalPages}
          </span>
        </>
      ) : (
        <span>
          {meta.page} / {meta.totalPages}
        </span>
      )}
      <button
        aria-label="다음 페이지"
        disabled={meta.page >= meta.totalPages}
        onClick={() => onPageChange(next)}
        type="button"
      >
        다음
      </button>
    </nav>
  );
}
