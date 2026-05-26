import React from 'react';
import styles from './Pagination.module.css';

const range = (start, end) =>
  Array.from({ length: end - start + 1 }, (_, i) => start + i);

const getPageNumbers = (current, total) => {
  if (total <= 7) return range(1, total);
  if (current <= 4) return [...range(1, 5), '...', total];
  if (current >= total - 3) return [1, '...', ...range(total - 4, total)];
  return [1, '...', ...range(current - 1, current + 1), '...', total];
};

const Pagination = ({ currentPage, totalPages, onPageChange, totalItems, pageSize }) => {
  if (totalPages <= 1) return null;
  const pages = getPageNumbers(currentPage, totalPages);
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className={styles.container}>
      <span className={styles.info}>
        Showing {start}–{end} of {totalItems} items
      </span>
      <div className={styles.controls}>
        <button
          className={styles.pageBtn}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ←
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className={styles.ellipsis}>…</span>
          ) : (
            <button
              key={p}
              className={`${styles.pageBtn} ${p === currentPage ? styles.active : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}
        <button
          className={styles.pageBtn}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          →
        </button>
      </div>
    </div>
  );
};

export default Pagination;
