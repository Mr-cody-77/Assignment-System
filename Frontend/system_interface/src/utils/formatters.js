/* ── Date & Time ─────────────────────────────────────────────────── */

export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

export const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return dateStr;
  }
};

/* ── Score ───────────────────────────────────────────────────────── */

export const formatScore = (score) => {
  if (score === null || score === undefined) return '—';
  const num = Number(score);
  if (isNaN(num)) return '—';
  const pct = normalizeScorePercent(num);
  return `${pct.toFixed(1)}%`;
};

export const normalizeScorePercent = (score) => {
  const num = Number(score);
  if (isNaN(num)) return 0;
  if (num >= 0 && num <= 1) return num * 100;
  return Math.min(Math.max(num, 0), 100);
};

export const averageScorePercent = (items = []) => {
  if (!items.length) return 0;
  const total = items.reduce((sum, item) => {
    const raw = typeof item === 'number' ? item : item?.score;
    return sum + normalizeScorePercent(raw);
  }, 0);
  return total / items.length;
};

/* ── Duration ────────────────────────────────────────────────────── */

export const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined) return '—';
  const s = Number(seconds);
  if (isNaN(s)) return '—';
  if (s < 1) return `${Math.round(s * 1000)}ms`;
  if (s < 60) return `${s.toFixed(2)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
};

/* ── Status ──────────────────────────────────────────────────────── */

export const formatStatus = (status) => {
  if (!status) return '—';
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const getStatusBadgeClass = (status) => {
  if (!status) return 'badge badge-neutral';
  const s = status.toLowerCase();
  if (['accepted', 'completed', 'success'].includes(s)) return 'badge badge-success';
  if (['wrong_answer', 'failed', 'runtime_error', 'time_limit_exceeded', 'memory_limit_exceeded'].includes(s))
    return 'badge badge-error';
  if (['partial', 'pending', 'queued'].includes(s)) return 'badge badge-warning';
  if (['running', 'processing'].includes(s)) return 'badge badge-info';
  return 'badge badge-neutral';
};

/* ── Language ────────────────────────────────────────────────────── */

export const getLanguageLabel = (lang) => {
  const map = {
    python: 'Python',
    cpp: 'C++',
    java: 'Java',
    javascript: 'JavaScript',
    js: 'JavaScript',
    c: 'C',
  };
  return map[lang?.toLowerCase()] || lang || '—';
};

/* ── Text ────────────────────────────────────────────────────────── */

export const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
};
