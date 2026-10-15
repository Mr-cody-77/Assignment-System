import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* ─── Status display config ─────────────────────────────────────────────── */
const STATUS_META = {
  accepted:              { label: 'Accepted',              color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  partial:               { label: 'Partial',               color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  wrong_answer:          { label: 'Wrong Answer',          color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  runtime_error:         { label: 'Runtime Error',         color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  time_limit_exceeded:   { label: 'Time Limit Exceeded',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  memory_limit_exceeded: { label: 'Memory Limit Exceeded', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

const statusMeta = (status) =>
  STATUS_META[status?.toLowerCase()] || { label: status || 'Not Attempted', color: '#8b9ec0', bg: 'rgba(139,158,192,0.1)' };

/**
 * Reusable Test Result Dashboard Screen
 * Used on test submission from both Question List and Question Code Editor pages.
 */
export default function TestResultScreen({ test, results = [], onDone }) {
  const [expanded, setExpanded] = useState({});
  const navigate = useNavigate();

  /* Map question_id (string) → latest result object */
  const resultByQId = {};
  (results || []).forEach(r => {
    const qid = String(r.question_id);
    const existing = resultByQId[qid];
    if (!existing || r.is_latest || (!existing.is_latest && new Date(r.submitted_at) > new Date(existing.submitted_at))) {
      resultByQId[qid] = r;
    }
  });

  /* Calculate totals */
  const questions = test?.questions || [];
  const totalMaxMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
  const totalObtained = questions.reduce((sum, q) => {
    const r = resultByQId[String(q.id)];
    return sum + (r ? (Number(r.score) || 0) : 0);
  }, 0);
  const roundedObtained = Math.round(totalObtained * 100) / 100;
  const pct = totalMaxMarks > 0 ? Math.round((roundedObtained / totalMaxMarks) * 100) : 0;

  const gradeColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  const handleFinish = () => {
    if (typeof onDone === 'function') {
      onDone();
    } else {
      navigate('/student');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '40px 24px',
      background: 'var(--clr-bg)',
    }}>
      {/* ── Score Banner ── */}
      <div style={{
        width: '100%',
        maxWidth: 720,
        background: 'linear-gradient(135deg, var(--clr-surface) 0%, var(--clr-surface-2) 100%)',
        border: '1px solid var(--clr-border)',
        borderRadius: 20,
        padding: '36px 40px',
        marginBottom: 28,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* decorative glow */}
        <div style={{
          position: 'absolute', top: -60, right: -60,
          width: 200, height: 200, borderRadius: '50%',
          background: `radial-gradient(circle, ${gradeColor}22 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ fontSize: 13, color: 'var(--clr-text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
          Test Submitted
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--clr-text)', margin: '0 0 4px' }}>
          {test?.name || test?.title || `Test #${test?.id || ''}`}
        </h1>
        <div style={{ fontSize: 13, color: 'var(--clr-text-2)', marginBottom: 28 }}>
          Test #{test?.id || ''} · {questions.length} Question{questions.length !== 1 ? 's' : ''}
        </div>

        {/* Big score circle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <div style={{
            width: 110, height: 110, borderRadius: '50%',
            border: `4px solid ${gradeColor}`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 28px ${gradeColor}44`,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: gradeColor, lineHeight: 1 }}>
              {pct}%
            </span>
          </div>
          <div>
            <div style={{ fontSize: 14, color: 'var(--clr-text-3)', marginBottom: 4 }}>Total Score</div>
            <div style={{ fontSize: 38, fontWeight: 900, color: 'var(--clr-text)', lineHeight: 1 }}>
              {totalObtained}
              <span style={{ fontSize: 20, fontWeight: 500, color: 'var(--clr-text-2)', marginLeft: 6 }}>
                / {totalMaxMarks}
              </span>
            </div>
            <div style={{ fontSize: 13, color: gradeColor, fontWeight: 600, marginTop: 6 }}>
              {pct >= 80 ? '🏆 Excellent!' : pct >= 50 ? '👍 Good effort' : '📚 Keep practising'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Per-Question Detail ── */}
      <div style={{ width: '100%', maxWidth: 720, marginBottom: 28 }}>
        <div style={{ fontSize: 13, color: 'var(--clr-text-3)', fontWeight: 600, marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Question-wise Breakdown
        </div>

        {questions.map((q, idx) => {
          const r = resultByQId[String(q.id)];
          const maxMarks = q.marks || 0;
          const earned = r ? (r.score || 0) : 0;
          const meta = statusMeta(r?.status);
          const isOpen = !!expanded[q.id];

          return (
            <div
              key={q.id}
              style={{
                background: 'var(--clr-surface)',
                border: '1px solid var(--clr-border)',
                borderRadius: 14,
                marginBottom: 12,
                overflow: 'hidden',
                transition: 'box-shadow 0.2s',
              }}
            >
              {/* Row header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 20px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onClick={() => setExpanded(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
              >
                {/* Q number */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--clr-bg-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: 'var(--clr-accent-light)',
                  flexShrink: 0,
                }}>
                  Q{idx + 1}
                </div>

                {/* Title */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--clr-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {q.title}
                  </div>
                  {r ? (
                    <div style={{ fontSize: 12, color: 'var(--clr-text-3)', marginTop: 2 }}>
                      {r.passed_testcases}/{r.total_testcases} test cases passed
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--clr-text-3)', marginTop: 2 }}>Not attempted</div>
                  )}
                </div>

                {/* Status badge */}
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: meta.color,
                  background: meta.bg,
                  padding: '4px 10px',
                  borderRadius: 20,
                  flexShrink: 0,
                }}>
                  {meta.label}
                </span>

                {/* Score */}
                <div style={{
                  textAlign: 'right', flexShrink: 0, minWidth: 64,
                }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: earned >= maxMarks ? '#10b981' : earned > 0 ? '#f59e0b' : 'var(--clr-text-3)' }}>
                    {earned}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--clr-text-3)' }}>/ {maxMarks} pts</div>
                </div>

                {/* Chevron */}
                <div style={{
                  color: 'var(--clr-text-3)',
                  fontSize: 18,
                  transition: 'transform 0.2s',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  flexShrink: 0,
                }}>
                  ▾
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{
                  borderTop: '1px solid var(--clr-border)',
                  padding: '16px 20px 20px',
                  background: 'var(--clr-bg-2)',
                  animation: 'fadeIn 0.15s ease',
                }}>
                  {r ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                      {/* Test Cases */}
                      <div style={{ background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 10, padding: '12px 16px' }}>
                        <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Test Cases</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{r.passed_testcases}</span>
                          <span style={{ color: 'var(--clr-text-3)', fontSize: 14 }}>/ {r.total_testcases}</span>
                        </div>
                        <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: 'var(--clr-bg-3)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 4,
                            width: r.total_testcases > 0 ? `${(r.passed_testcases / r.total_testcases) * 100}%` : '0%',
                            background: r.passed_testcases === r.total_testcases ? '#10b981' : r.passed_testcases > 0 ? '#f59e0b' : '#ef4444',
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginTop: 4 }}>
                          {r.total_testcases > 0 ? `${Math.round((r.passed_testcases / r.total_testcases) * 100)}% pass rate` : '—'}
                        </div>
                      </div>

                      {/* Score Earned */}
                      <div style={{ background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 10, padding: '12px 16px' }}>
                        <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Marks Earned</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontSize: 22, fontWeight: 800, color: earned >= maxMarks ? '#10b981' : earned > 0 ? '#f59e0b' : '#ef4444' }}>{earned}</span>
                          <span style={{ color: 'var(--clr-text-3)', fontSize: 14 }}>/ {maxMarks}</span>
                        </div>
                        <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: 'var(--clr-bg-3)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 4,
                            width: maxMarks > 0 ? `${(earned / maxMarks) * 100}%` : '0%',
                            background: earned >= maxMarks ? '#10b981' : earned > 0 ? '#f59e0b' : '#ef4444',
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                      </div>

                      {/* Execution Time */}
                      <div style={{ background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 10, padding: '12px 16px' }}>
                        <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Execution Time</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--clr-accent-light)' }}>
                          {r.execution_time != null ? `${parseFloat(r.execution_time).toFixed(2)}s` : '—'}
                        </div>
                      </div>

                      {/* Status */}
                      <div style={{ background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 10, padding: '12px 16px' }}>
                        <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Final Status</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>{meta.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginTop: 4 }}>
                          Submitted {new Date(r.submitted_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--clr-text-3)', fontSize: 13, padding: '4px 0' }}>
                      ⚠️ No submission found for this question.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── CTA ── */}
      <div style={{ width: '100%', maxWidth: 720, display: 'flex', justifyContent: 'center' }}>
        <button
          className="btn btn-primary"
          style={{ padding: '14px 48px', fontSize: 16, fontWeight: 700, borderRadius: 12 }}
          onClick={handleFinish}
        >
          🏠 Back to Dashboard
        </button>
      </div>
    </div>
  );
}
