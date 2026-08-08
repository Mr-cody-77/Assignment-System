import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import EmptyState from '../../components/common/EmptyState';
import { SkeletonCard } from '../../components/Loader/SkeletonLoader';
import { getTestById, submitTest } from '../../services/testService';
import { submitTask, getTaskStatus } from '../../services/taskService';
import { getMyResults } from '../../services/resultService';
import Timer from '../../components/Timer/Timer';
import styles from './Assignments.module.css';

/* ─── Status display config ─────────────────────────────────────────────── */
const STATUS_META = {
  accepted:             { label: 'Accepted',             color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  partial:              { label: 'Partial',              color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  wrong_answer:         { label: 'Wrong Answer',         color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  runtime_error:        { label: 'Runtime Error',        color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  time_limit_exceeded:  { label: 'Time Limit Exceeded',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  memory_limit_exceeded:{ label: 'Memory Limit Exceeded',color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

const statusMeta = (status) =>
  STATUS_META[status?.toLowerCase()] || { label: status || 'Not Attempted', color: '#8b9ec0', bg: 'rgba(139,158,192,0.1)' };

/* ─── Inline Result Screen ───────────────────────────────────────────────── */
function TestResultScreen({ test, results, onDone }) {
  const [expanded, setExpanded] = useState({});
  const navigate = useNavigate();

  /* Map question_id (string) → result object */
  const resultByQId = {};
  results.forEach(r => { resultByQId[String(r.question_id)] = r; });

  /* Calculate totals */
  const questions = test.questions || [];
  const totalMaxMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
  const totalObtained = questions.reduce((sum, q) => {
    const r = resultByQId[String(q.id)];
    return sum + (r ? (r.score || 0) : 0);
  }, 0);
  const pct = totalMaxMarks > 0 ? Math.round((totalObtained / totalMaxMarks) * 100) : 0;

  const gradeColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

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
          {test.name || test.title || `Test #${test.id}`}
        </h1>
        <div style={{ fontSize: 13, color: 'var(--clr-text-2)', marginBottom: 28 }}>
          Test #{test.id} · {questions.length} Question{questions.length !== 1 ? 's' : ''}
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
                      <div style={{
                        background: 'var(--clr-surface)',
                        border: '1px solid var(--clr-border)',
                        borderRadius: 10,
                        padding: '12px 16px',
                      }}>
                        <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Test Cases
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{r.passed_testcases}</span>
                          <span style={{ color: 'var(--clr-text-3)', fontSize: 14 }}>/ {r.total_testcases}</span>
                        </div>
                        {/* Mini progress bar */}
                        <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: 'var(--clr-bg-3)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            borderRadius: 4,
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
                      <div style={{
                        background: 'var(--clr-surface)',
                        border: '1px solid var(--clr-border)',
                        borderRadius: 10,
                        padding: '12px 16px',
                      }}>
                        <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Marks Earned
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontSize: 22, fontWeight: 800, color: earned >= maxMarks ? '#10b981' : earned > 0 ? '#f59e0b' : '#ef4444' }}>
                            {earned}
                          </span>
                          <span style={{ color: 'var(--clr-text-3)', fontSize: 14 }}>/ {maxMarks}</span>
                        </div>
                        {/* Mini progress bar */}
                        <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: 'var(--clr-bg-3)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            borderRadius: 4,
                            width: maxMarks > 0 ? `${(earned / maxMarks) * 100}%` : '0%',
                            background: earned >= maxMarks ? '#10b981' : earned > 0 ? '#f59e0b' : '#ef4444',
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                      </div>

                      {/* Execution Time */}
                      <div style={{
                        background: 'var(--clr-surface)',
                        border: '1px solid var(--clr-border)',
                        borderRadius: 10,
                        padding: '12px 16px',
                      }}>
                        <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Execution Time
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--clr-accent-light)' }}>
                          {r.execution_time != null ? `${parseFloat(r.execution_time).toFixed(2)}s` : '—'}
                        </div>
                      </div>

                      {/* Status */}
                      <div style={{
                        background: 'var(--clr-surface)',
                        border: '1px solid var(--clr-border)',
                        borderRadius: 10,
                        padding: '12px 16px',
                      }}>
                        <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Final Status
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>
                          {meta.label}
                        </div>
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
          onClick={() => navigate('/student')}
        >
          🏠 Back to Dashboard
        </button>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
const TestQuestions = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  /* Result screen state */
  const [testResult, setTestResult] = useState(null); // { test, results }

  const examActive = localStorage.getItem('exam_active') === 'true';
  const examDuration = parseInt(localStorage.getItem('exam_duration') || '60', 10);

  const handleExamEnd = () => {
    setShowEmailModal(true);
  };

  const confirmExamEnd = async (e) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      addToast('Please enter a valid email address.', 'warning');
      return;
    }
    setEmailSubmitting(true);
    try {
      const { updateUserEmail } = await import('../../services/userService');
      await updateUserEmail(emailInput);
    } catch (err) {
      addToast('Failed to save email, but submitting test...', 'warning');
    }
    setEmailSubmitting(false);
    setShowEmailModal(false);
    await handleSubmitTest();
  };

  useEffect(() => {
    if (!examActive) {
      setLoading(false);
      return;
    }

    const fetchTest = async () => {
      try {
        const testId = localStorage.getItem('exam_test_id');
        if (testId) {
          /* Fast path — fetch only the one active test */
          const data = await getTestById(testId);
          setTest(data);
        } else {
          /* Fallback — shouldn't normally happen after StartExam stores the ID */
          const { getAllTests } = await import('../../services/testService');
          const tests = await getAllTests();
          if (tests && tests.length > 0) {
            setTest(tests[0]);
            localStorage.setItem('exam_test_id', String(tests[0].id));
          }
        }
      } catch (err) {
        console.error('Failed to fetch test', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTest();
  }, [examActive]);

  /* Clear exam state from localStorage */
  const clearExamStorage = () => {
    localStorage.removeItem('exam_active');
    localStorage.removeItem('exam_duration');
    localStorage.removeItem('exam_end_time');
    localStorage.removeItem('exam_test_id');
  };

  const handleSubmitTest = async () => {
    if (submitting) return;
    setSubmitting(true);

    const testId = localStorage.getItem('exam_test_id') || (test && test.id);

    /* 0. Auto-submit any cached code that hasn't been evaluated yet */
    if (test && test.questions && user?.username) {
      const buildSubmitQuestion = (q) => {
        const visible = Array.isArray(q?.test_cases) ? q.test_cases : [];
        const hidden = Array.isArray(q?.hidden_test_cases) ? q.hidden_test_cases : [];
        const totalCases = Math.max(visible.length + hidden.length, 1);
        const normalize = (cases, startIdx) => cases.map((c, i) => ({
          ...c, order: startIdx + i + 1, points: Number(c.points) || Number((100/totalCases).toFixed(4))
        }));
        return {
          ...q,
          max_score: q.marks || q.max_score || 100,
          time_limit_ms: q.time_limit_ms || 2000,
          memory_limit_mb: q.memory_limit_mb || 256,
          test_cases: normalize(visible, 0),
          hidden_test_cases: normalize(hidden, visible.length),
        };
      };

      for (const q of test.questions) {
        const cachedCode = sessionStorage.getItem(`code_cache_${q.id}`);
        const cachedLang = sessionStorage.getItem(`language_cache_${q.id}`) || 'python';
        // We will just submit the cached code for all questions, 
        // the backend logic handles overriding/processing them correctly.
        if (cachedCode) {
          try {
            await submitTask({
              roll_number: user.username,
              question: buildSubmitQuestion(q),
              language: cachedLang,
              solution: cachedCode,
            });
          } catch (err) {
            console.error(`Failed to auto-submit code for Q${q.id}:`, err);
          }
        }
      }

      // Poll until all auto-submitted tasks finish or timeout after 10s
      try {
        for (let i = 0; i < 10; i++) {
          const statuses = await getTaskStatus();
          const pending = statuses.filter(t => 
            t.roll_number === user?.username && 
            ['pending', 'queued', 'running'].includes(t.status?.toLowerCase())
          );
          if (pending.length === 0) break;
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (err) {
        console.error("Error polling task status:", err);
      }
    }

    /* 1. Submit the test record */
    try {
      await submitTest(testId);
      addToast('Test submitted successfully!', 'success');
    } catch (err) {
      console.error('Failed to submit test:', err);
      /* Non-blocking — still proceed to show results */
    }

    /* 3. Fetch per-question results from Centralized DB */
    let results = [];
    try {
      if (user?.username) {
        results = await getMyResults(user.username);
        if (!Array.isArray(results)) results = [];
      }
    } catch (err) {
      console.error('Failed to fetch results:', err);
    }

    /* 4. Clear exam state */
    clearExamStorage();
    setSubmitting(false);

    /* 5. Show inline result screen */
    if (test) {
      setTestResult({ test, results });
    } else {
      navigate('/student');
    }
  };

  /* ── Timer expired auto-submit ── */
  const handleTimeUp = async () => {
    await handleSubmitTest();
  };

  /* ── Result screen: show instead of question list ── */
  if (testResult) {
    return (
      <div className="app-shell">
        <Sidebar role="student" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="main-content">
          <Header
            title="Test Results"
            subtitle="Your final score"
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          />
          <div className="page-body" style={{ padding: 0 }}>
            <TestResultScreen
              test={testResult.test}
              results={testResult.results}
              onDone={() => navigate('/student')}
            />
          </div>
        </div>
      </div>
    );
  }

  /* ── Normal exam view ── */
  return (
    <div className="app-shell">
      <Sidebar role="student" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Test Questions"
          subtitle={test ? `Questions for ${test.name || test.title}` : 'Test Details'}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          actions={
            examActive && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Timer durationMinutes={examDuration} onTimeUp={handleTimeUp} />
                <button
                  className="btn btn-success btn-sm"
                  onClick={handleExamEnd}
                  disabled={submitting}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {submitting ? (
                    <><span className="spinner" style={{ width: 14, height: 14 }} /> Submitting…</>
                  ) : '📤 Submit Test'}
                </button>
              </div>
            )
          }
        />
        <div className="page-body">
          {!examActive ? (
            <EmptyState
              icon="🔒"
              title="You must start a test to view questions."
              description="Please go to the dashboard to start the test."
            />
          ) : loading ? (
            <div className={styles.assignmentsGrid}>
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : !test || !test.questions || test.questions.length === 0 ? (
            <EmptyState
              icon="📝"
              title="No questions found."
              description="This test doesn't have any questions yet."
            />
          ) : (
            <div className={styles.assignmentsGrid}>
              {test.questions.map((q) => (
                <div
                  key={q.id}
                  style={{
                    position: 'relative',
                    opacity: q.is_solved ? 0.75 : 1,
                    transition: 'opacity 0.2s',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--clr-border)',
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate(`/student/tests/question/${q.id}`)}
                >
                  {q.is_solved && (
                    <div style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      zIndex: 10,
                      background: 'rgba(16, 185, 129, 0.9)',
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      pointerEvents: 'none',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                      ✅ Solved
                    </div>
                  )}
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: 'var(--clr-text)' }}>{q.title}</h3>
                  <div style={{ color: 'var(--clr-primary)', fontWeight: 'bold' }}>
                    {q.marks || q.max_score || 0} Marks
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {showEmailModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{
            background: 'var(--clr-surface)', padding: '32px', borderRadius: '20px',
            width: '90%', maxWidth: '440px', boxShadow: '0 24px 50px rgba(0,0,0,0.5)',
            border: '1px solid var(--clr-border)',
            display: 'flex', flexDirection: 'column', gap: '16px'
          }}>
            <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--clr-text)' }}>
              Enter Preferred Email
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--clr-text-2)', lineHeight: 1.5 }}>
              Where would you like to receive your final score and plagiarism check results?
            </p>
            <form onSubmit={confirmExamEnd} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '8px' }}>
              <div>
                <input
                  type="email"
                  placeholder="student@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '10px',
                    border: '1px solid var(--clr-border)', background: 'var(--clr-bg-2)',
                    color: 'var(--clr-text)', fontSize: '15px', outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.border = '1px solid var(--clr-primary)'}
                  onBlur={(e) => e.target.style.border = '1px solid var(--clr-border)'}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 600 }}
                  onClick={() => setShowEmailModal(false)}
                  disabled={emailSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 600, background: 'var(--clr-primary)' }}
                  disabled={emailSubmitting}
                >
                  {emailSubmitting ? 'Submitting...' : 'Submit & End Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestQuestions;
