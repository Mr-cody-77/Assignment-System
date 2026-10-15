import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import CodeEditor, { TEMPLATES } from '../../components/CodeEditor/CodeEditor';
import TerminalPanel from '../../components/TerminalPanel/TerminalPanel';
import Loader from '../../components/Loader/Loader';
import { getAssignmentById } from '../../services/assignmentService';
import { submitTask } from '../../services/taskService';
import { runVisibleTestCases } from '../../services/localExecutionService';
import Timer from '../../components/Timer/Timer';
import { getTestById } from '../../services/testService';
import styles from './AssignmentDetails.module.css';
import TestResultScreen from '../../components/TestResultScreen/TestResultScreen';

// BUG-09 FIX: Import shared utilities — no more duplicated buildSubmitQuestion /
// addPointsToCases logic that could diverge from TestQuestions.jsx
import { buildSubmitQuestion } from '../../utils/examUtils';
// BUG-07 FIX: Import shared submission hook — one canonical pipeline for both pages
import useExamSubmit from '../../hooks/useExamSubmit';

const AssignmentDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [question, setQuestion] = useState(null);
  const [test, setTest] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [language, setLanguage] = useState(() => {
    const cached = sessionStorage.getItem(`language_cache_${id}`);
    if (!cached) {
      sessionStorage.setItem(`language_cache_${id}`, 'python');
    }
    return cached || 'python';
  });
  const [code, setCode] = useState(() => {
    const cachedLang = sessionStorage.getItem(`language_cache_${id}`) || 'python';
    const cached = sessionStorage.getItem(`code_cache_${id}`);
    return cached || TEMPLATES[cachedLang] || TEMPLATES.python;
  });
  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const [activeTab, setActiveTab] = useState('description');

  const [running, setRunning] = useState(false);
  const [codeSubmitting, setCodeSubmitting] = useState(false);
  const [submittedTaskId, setSubmittedTaskId] = useState(null);
  const [terminalResults, setTerminalResults] = useState(null);

  const examActive = localStorage.getItem('exam_active') === 'true';
  const initialExamActive = useRef(examActive);
  const examSubmittedRef = useRef(false);
  const examDuration = parseInt(localStorage.getItem('exam_duration') || '60', 10);

  // Use the single shared exam submission hook.
  const {
    submitting: examSubmitting,
    emailInput,
    setEmailInput,
    emailSubmitting,
    showEmailModal,
    setShowEmailModal,
    handleExamEnd,
    confirmExamEnd,
    handleTimeUp,
  } = useExamSubmit({
    user,
    addToast,
    onSuccess: ({ test: submittedTest, results }) => {
      examSubmittedRef.current = true;
      setError('');
      // Show the inline result screen after submission — exactly like TestQuestions.jsx
      if (submittedTest) {
        setTestResult({ test: submittedTest, results });
      } else if (test) {
        setTestResult({ test, results });
      } else {
        navigate('/student');
      }
    },
  });

  const onInitiateSubmitTest = () => {
    // Ensure the current editor code and language are cached before submitting
    if (id && code) {
      sessionStorage.setItem(`code_cache_${id}`, code);
      sessionStorage.setItem(`language_cache_${id}`, language);
    }
    handleExamEnd();
  };

  useEffect(() => {
    // If test was already submitted or result is displayed, do NOT fetch question or redirect!
    if (testResult || examSubmittedRef.current) return;

    // Only redirect if exam was NOT active when arriving, and no result or submit in flight
    if (!initialExamActive.current && !examSubmitting) {
      navigate('/student');
      return;
    }

    const testId = localStorage.getItem('exam_test_id');
    if (testId) {
      getTestById(testId)
        .then((data) => setTest(data))
        .catch((err) => console.error('Failed to load test in AssignmentDetails:', err));
    }

    const fetchQuestion = async () => {
      if (examSubmittedRef.current || testResult || examSubmitting) return;
      try {
        const data = await getAssignmentById(id);
        if (examSubmittedRef.current || testResult) return;
        setQuestion(data);
        if (!testId && data?.test) {
          getTestById(data.test)
            .then((t) => setTest(t))
            .catch((e) => console.error('Failed to load test from question:', e));
        }
      } catch (err) {
        if (!examSubmittedRef.current && !testResult && !examSubmitting) {
          const msg = err?.response?.data?.error || err?.message || 'Failed to load assignment.';
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchQuestion();
  }, [id, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync language and code when the question ID changes
  useEffect(() => {
    const cachedLang = sessionStorage.getItem(`language_cache_${id}`) || 'python';
    if (!sessionStorage.getItem(`language_cache_${id}`)) {
      sessionStorage.setItem(`language_cache_${id}`, 'python');
    }
    const cachedCode = sessionStorage.getItem(`code_cache_${id}`);

    setLanguage(cachedLang);
    setCode(cachedCode || TEMPLATES[cachedLang] || TEMPLATES.python);
    setTerminalResults(null);
    setSubmittedTaskId(null);
  }, [id]);

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    sessionStorage.setItem(`code_cache_${id}`, newCode);
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    sessionStorage.setItem(`language_cache_${id}`, lang);
  };

  const handleRun = async () => {
    if (!question?.test_cases?.length) {
      addToast('No visible test cases for this problem.', 'info');
      return;
    }
    if (!code.trim()) {
      addToast('Please write your solution first.', 'warning');
      return;
    }

    setRunning(true);
    setTerminalResults(null);
    try {
      const results = await runVisibleTestCases({
        language,
        code,
        testCases: question.test_cases,
        timeLimitMs: question.time_limit_ms || 2000,
      });
      setTerminalResults(results);
      const passed = results.filter((result) => result.passed).length;
      addToast(
        `Visible tests: ${passed}/${results.length} passed.`,
        passed === results.length ? 'success' : 'warning'
      );
    } catch (err) {
      addToast(err?.message || 'Local run failed.', 'error');
    } finally {
      setRunning(false);
    }
  };

  // Individual-question submit (the "⬆ Submit" button in the editor panel)
  const handleSubmit = async () => {
    if (!code.trim()) { addToast('Please write your solution first.', 'warning'); return; }
    setCodeSubmitting(true);
    try {
      const res = await submitTask({
        roll_number: user.roll_number || user.username,
        question: buildSubmitQuestion(question),
        language,
        solution: code,
        email: localStorage.getItem('preferred_email') || user.email || '',
      });
      setSubmittedTaskId(res.task_id);
      addToast(`Task submitted! ID: ${res.task_id}`, 'success', 6000);
      navigate('/student/tasks');
    } catch (err) {
      addToast(err?.response?.data?.message || 'Submission failed. Please try again.', 'error');
    } finally {
      setCodeSubmitting(false);
    }
  };

  // Parse examples safely
  const parseExamples = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch { return [{ input: String(raw) }]; }
  };

  /* ── Result screen: show dashboard after submitting test ── */
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

  if (loading) return <Loader fullPage text="Loading problem…" />;
  if (error || !question) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
        <span style={{ fontSize: 48 }}>😕</span>
        <p style={{ color: 'var(--clr-error)', maxWidth: 480, textAlign: 'center', lineHeight: 1.5 }}>
          {error || 'Assignment not found'}
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/student')}>← Back to Dashboard</button>
      </div>
    );
  }

  const visibleTestCases = question.test_cases || [];
  const examples = parseExamples(question.examples);

  return (
    <div className="app-shell">
      <Sidebar role="student" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title={question.title}
          subtitle={`Problem #${id} | ${question.marks || question.max_score || 0} Marks`}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {examActive && (
                <>
                  <Timer
                    durationMinutes={examDuration}
                    onTimeUp={() => {
                      examSubmittedRef.current = true;
                      if (id && code) {
                        sessionStorage.setItem(`code_cache_${id}`, code);
                        sessionStorage.setItem(`language_cache_${id}`, language);
                      }
                      handleTimeUp(test);
                    }}
                  />
                  <button
                    className="btn btn-success btn-sm"
                    onClick={onInitiateSubmitTest}
                    disabled={examSubmitting}
                  >
                    {examSubmitting ? (
                      <><span className="spinner" style={{ width: 14, height: 14 }} /> Submitting…</>
                    ) : '📤 Submit Test'}
                  </button>
                </>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRun}
                disabled={codeSubmitting || running || examSubmitting}
              >
                {running ? 'Running...' : 'Run'}
              </button>
              <button
                className="btn btn-success btn-sm"
                onClick={handleSubmit}
                disabled={codeSubmitting || running || examSubmitting}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {codeSubmitting ? (
                  <><span className="spinner" style={{ width: 14, height: 14 }} /> Submitting…</>
                ) : '⬆ Submit'}
              </button>
            </div>
          }
        />

        <div className="coding-layout">
          {/* ── Left: Problem Panel ──────────────────── */}
          <div className="problem-panel">
            {/* Test case counts */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <span className="badge badge-info">{visibleTestCases.length} visible test cases</span>
              <span className="badge badge-neutral">{question.hidden_test_cases?.length || 0} hidden</span>
            </div>

            {/* Tabs */}
            <div className="tabs" style={{ marginBottom: 16 }}>
              {['description', 'examples', 'testcases'].map((tab) => (
                <button
                  key={tab}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'description' ? 'Description' : tab === 'examples' ? 'Examples' : 'Test Cases'}
                </button>
              ))}
            </div>

            {activeTab === 'description' && (
              <div>
                <h2 className="problem-title">{question.title}</h2>
                <div className="problem-section">
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14, lineHeight: 1.8, color: 'var(--clr-text)' }}>
                    {question.description}
                  </pre>
                </div>
                {question.input_format && (
                  <div className={styles.constraintsBox} style={{ marginBottom: 16 }}>
                    <div className={styles.constraintsLabel}>Input Format</div>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--clr-text-2)', lineHeight: 1.6 }}>
                      {question.input_format}
                    </pre>
                  </div>
                )}
                {question.output_format && (
                  <div className={styles.constraintsBox} style={{ marginBottom: 16 }}>
                    <div className={styles.constraintsLabel}>Output Format</div>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--clr-text-2)', lineHeight: 1.6 }}>
                      {question.output_format}
                    </pre>
                  </div>
                )}
                {question.constraints && (
                  <div className={styles.constraintsBox}>
                    <div className={styles.constraintsLabel}>Constraints</div>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--clr-text-2)' }}>
                      {question.constraints}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'examples' && (
              <div>
                {examples.length === 0 ? (
                  <p style={{ color: 'var(--clr-text-3)', fontSize: 14 }}>No examples provided.</p>
                ) : examples.map((ex, i) => (
                  <div key={i} className="example-block" style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--clr-text-2)' }}>
                      Example {i + 1}
                    </div>
                    {ex.input !== undefined && (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--clr-text-3)', fontWeight: 700 }}>Input: </span>
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{String(ex.input)}</code>
                      </div>
                    )}
                    {ex.output !== undefined && (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--clr-text-3)', fontWeight: 700 }}>Output: </span>
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{String(ex.output)}</code>
                      </div>
                    )}
                    {ex.explanation && (
                      <div style={{ fontSize: 13, color: 'var(--clr-text-2)', fontStyle: 'italic' }}>
                        {ex.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'testcases' && (
              <div>
                {visibleTestCases.length === 0 ? (
                  <p style={{ color: 'var(--clr-text-3)', fontSize: 14 }}>No visible test cases.</p>
                ) : visibleTestCases.map((tc, i) => (
                  <div key={tc.id || i} className={styles.testCaseItem}>
                    <div className={styles.tcLabel}>Case {i + 1}</div>
                    <div style={{ marginBottom: 6 }}>
                      <span className={styles.tcSubLabel}>Input:</span>
                      <pre className={styles.tcCode}>{tc.input_data}</pre>
                    </div>
                    <div>
                      <span className={styles.tcSubLabel}>Expected Output:</span>
                      <pre className={styles.tcCode}>{tc.expected_output}</pre>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Submitted task banner */}
            {submittedTaskId && (
              <div className={styles.submittedBanner}>
                <span>✓ Task submitted!</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigate('/student/tasks')}
                  style={{ marginLeft: 8 }}
                >
                  View Status →
                </button>
              </div>
            )}
          </div>

          {/* ── Right: Editor + Terminal ─────────────── */}
          <div className="editor-panel">
            <div className="editor-container">
              <CodeEditor
                key={id}
                value={code}
                onChange={handleCodeChange}
                language={language}
                onLanguageChange={handleLanguageChange}
                theme={editorTheme}
                onThemeChange={setEditorTheme}
                height="100%"
              />
            </div>
            <div className="result-panel">
              <TerminalPanel
                testCases={visibleTestCases}
                results={terminalResults}
                isRunning={running}
                onClear={() => setTerminalResults(null)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Email confirmation modal — rendered by the shared hook state */}
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
            <form
              onSubmit={(e) => {
                examSubmittedRef.current = true;
                if (id && code) {
                  sessionStorage.setItem(`code_cache_${id}`, code);
                  sessionStorage.setItem(`language_cache_${id}`, language);
                }
                confirmExamEnd(e, test);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '8px' }}
            >
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

export default AssignmentDetails;
