interface Props {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, pageSize, totalCount, onPageChange }: Props) {
  const totalPages = Math.ceil(totalCount / pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  const pageNumbers = (): (number | '...')[] => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="pagination">
      <span>{`Showing ${start.toLocaleString()}-${end.toLocaleString()} of ${totalCount.toLocaleString()} rows`}</span>
      <div className="pagination-controls">
        <span
          className="pagination-btn"
          style={{ opacity: page === 1 ? 0.3 : 1, pointerEvents: page === 1 ? 'none' : 'auto' }}
          onClick={() => onPageChange(page - 1)}
        >
          ← Prev
        </span>
        {pageNumbers().map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="pagination-ellipsis">...</span>
          ) : (
            <span
              key={p}
              className={`pagination-btn ${p === page ? 'pagination-active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </span>
          )
        )}
        <span
          className="pagination-btn"
          style={{ opacity: page === totalPages ? 0.3 : 1, pointerEvents: page === totalPages ? 'none' : 'auto' }}
          onClick={() => onPageChange(page + 1)}
        >
          Next →
        </span>
      </div>
      <span>{pageSize.toLocaleString()} rows/page</span>
    </div>
  );
}
