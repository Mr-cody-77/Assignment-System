/* ── CSV Export ──────────────────────────────────────────────────── */

export const exportToCSV = (data, filename = 'export.csv') => {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
          // Escape commas and quotes
          return val.includes(',') || val.includes('"') || val.includes('\n')
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        })
        .join(',')
    ),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/* ── ID Generation ───────────────────────────────────────────────── */

export const generateId = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

/* ── Debounce ────────────────────────────────────────────────────── */

export const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

/* ── Class Names ─────────────────────────────────────────────────── */

export const classNames = (...classes) =>
  classes.filter(Boolean).join(' ');

/* ── Initials ────────────────────────────────────────────────────── */

export const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/* ── Pagination ──────────────────────────────────────────────────── */

export const paginateData = (data = [], page = 1, pageSize = 10) => {
  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const items = data.slice(start, start + pageSize);
  return { items, totalPages, totalItems, currentPage: safePage };
};

/* ── Sort ────────────────────────────────────────────────────────── */

export const sortData = (data = [], key, direction = 'asc') => {
  if (!key) return data;
  return [...data].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv));
    return direction === 'asc' ? cmp : -cmp;
  });
};

/* ── Filter ──────────────────────────────────────────────────────── */

export const filterData = (data = [], searchTerm = '', searchKeys = []) => {
  if (!searchTerm.trim() || searchKeys.length === 0) return data;
  const term = searchTerm.toLowerCase();
  return data.filter((item) =>
    searchKeys.some((key) => {
      const val = item[key];
      return val !== null && val !== undefined && String(val).toLowerCase().includes(term);
    })
  );
};
