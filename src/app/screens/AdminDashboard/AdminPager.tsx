import type { PageMeta } from "../../../lib/types";

type AdminPagerProps = {
  meta: PageMeta;
  onPageChange: (page: number) => void;
};

export default function AdminPager({ meta, onPageChange }: AdminPagerProps) {
  if (meta.totalPages <= 1) return null;

  const previous = Math.max(1, meta.page - 1);
  const next = Math.min(meta.totalPages, meta.page + 1);

  return (
    <div className="admin-list-pager">
      <button
        disabled={meta.page <= 1}
        onClick={() => onPageChange(previous)}
        type="button"
      >
        이전
      </button>
      <span>
        {meta.page} / {meta.totalPages}
      </span>
      <button
        disabled={meta.page >= meta.totalPages}
        onClick={() => onPageChange(next)}
        type="button"
      >
        다음
      </button>
    </div>
  );
}
