import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import CodeEditor from '../../components/CodeEditor/CodeEditor';
import TerminalPanel from '../../components/TerminalPanel/TerminalPanel';
import Loader from '../../components/Loader/Loader';
import { getAssignmentById } from '../../services/assignmentService';
import { submitTask, getTaskStatus } from '../../services/taskService';
import { runVisibleTestCases } from '../../services/localExecutionService';
import Timer from '../../components/Timer/Timer';
import { submitTest, getTestById } from '../../services/testService';
import { updateUserEmail } from '../../services/userService';
import styles from './AssignmentDetails.module.css';

const TEMPLATES = {
  python: '# Write your Python solution here\n\ndef solution():\n    pass\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Read input from stdin (e.g., cin >> a >> b;)\n    // Write your C++ solution here\n    // Print output to stdout (e.g., cout << result << endl;)\n\n    return 0;\n}\n',
  java: 'public class Solution {\n    public static void main(String[] args) {\n        // Write your Java solution here\n    }\n}\n',
  javascript: '// Use readline() for stdin and console.log() for output\n\nfunction solution() {\n  const line = readline();\n  console.log(line);\n}\n',
};

const addPointsToCases = (cases = [], startIndex = 0, totalCases = 1) =>
  cases.map((testCase, index) => ({
    ...testCase,
    order: startIndex + index + 1,
    points: Number(testCase.points) || Number((100 / totalCases).toFixed(4)),
  }));

const buildSubmitQuestion = (question) => {
  const visible = Array.isArray(question?.test_cases) ? question.test_cases : [];
  const hidden = Array.isArray(question?.hidden_test_cases) ? question.hidden_test_cases : [];
  const totalCases = Math.max(visible.length + hidden.length, 1);

  return {
    ...question,
    max_score: question.marks || question.max_score || 100,
    time_limit_ms: question.time_limit_ms || 2000,
    memory_limit_mb: question.memory_limit_mb || 256,
    test_cases: addPointsToCases(visible, 0, totalCases),
    hidden_test_cases: addPointsToCases(hidden, visible.length, totalCases),
  };
};

const AssignmentDetails = () => {
  const { id } = useParams();
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [code, setCode] = useState(() => {
    const cached = localStorage.getItem(`code_cache_${id}`);
    return cached || TEMPLATES.python;
  });
  const [language, setLanguage] = useState(() => {
    const cached = localStorage.getItem(`language_cache_${id}`);
    return cached || 'python';
  });
  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const [activeTab, setActiveTab] = useState('description');

  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedTaskId, setSubmittedTaskId] = useState(null);
  const [terminalResults, setTerminalResults] = useState(null);

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);

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
      await updateUserEmail(emailInput);
    } catch (err) {
      addToast('Failed to save email, but submitting test...', 'warning');
    }

    const testId = localStorage.getItem('exam_test_id');
    if (testId && user?.username) {
      try {
        const testData = await getTestById(testId);
        if (testData && testData.questions) {
          addToast('Auto-submitting your code solutions...', 'info');
          
          for (const q of testData.questions) {
            const cachedCode = localStorage.getItem(`code_cache_${q.id}`);
            const cachedLang = localStorage.getItem(`language_cache_${q.id}`) || 'python';
            if (cachedCode) {
              try {
                await submitTask({
                  roll_number: user.username,
                  question: buildSubmitQuestion(q),
                  language: cachedLang,
                  solution: cachedCode,
                });
              } catch (err) {
                console.error(`Failed to auto-submit Q${q.id}:`, err);
              }
            }
          }

          // Poll for completion
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
      } catch (err) {
        console.error('Failed to auto-submit test tasks:', err);
      }
    }
    
    try {
      // Submit the test formally
      if (testId) {
        await submitTest(testId);
        addToast('Test submitted successfully!', 'success');
      }
    } catch (err) {
      console.error('Failed to submit test:', err);
    } finally {
      setEmailSubmitting(false);
      localStorage.removeItem('exam_active');
      localStorage.removeItem('exam_duration');
      localStorage.removeItem('exam_end_time');
      localStorage.removeItem('exam_test_id');
      navigate('/student');
    }
  };

  useEffect(() => {
    if (!examActive) {
      navigate('/student');
      return;
    }
    const fetch = async () => {
      try {
        const data = await getAssignmentById(id);
        setQuestion(data);
      } catch (err) {
        setError('Failed to load assignment.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id, examActive, navigate]);

  // Sync the code editor when the question ID changes
  useEffect(() => {
    const cached = localStorage.getItem(`code_cache_${id}`);
    setCode(cached || TEMPLATES[language] || TEMPLATES.python);
    setTerminalResults(null);
    setSubmittedTaskId(null);
  }, [id]);

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    localStorage.setItem(`code_cache_${id}`, newCode);
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    localStorage.setItem(`language_cache_${id}`, lang);
    // Apply template if code is empty or is still a template
    if (!code || Object.values(TEMPLATES).includes(code)) {
      const templateCode = TEMPLATES[lang] || '';
      setCode(templateCode);
      localStorage.setItem(`code_cache_${id}`, templateCode);
    }
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

  const handleSubmit = async () => {
    if (!code.trim()) { addToast('Please write your solution first.', 'warning'); return; }
    setSubmitting(true);
    try {
      const res = await submitTask({
        roll_number: user.username,
        question: buildSubmitQuestion(question),
        language,
        solution: code,
      });
      setSubmittedTaskId(res.task_id);
      addToast(`Task submitted! ID: ${res.task_id}`, 'success', 6000);
      navigate('/student/tasks');
    } catch (err) {
      addToast(err?.response?.data?.message || 'Submission failed. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Parse examples safely
  const parseExamples = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch { return [{ input: String(raw) }]; }
  };

  if (loading) return <Loader fullPage text="Loading problem…" />;
  if (error || !question) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
        <span style={{ fontSize: 48 }}>😕</span>
        <p style={{ color: 'var(--clr-error)' }}>{error || 'Assignment not found'}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/student/assignments')}>← Back</button>
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
                  <Timer durationMinutes={examDuration} onTimeUp={handleExamEnd} />
                  <button className="btn btn-success btn-sm" onClick={handleExamEnd}>
                    📤 Submit Test
                  </button>
                </>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRun}
                disabled={submitting || running}
              >
                {running ? 'Running...' : 'Run'}
              </button>
              <button
                className="btn btn-success btn-sm"
                onClick={handleSubmit}
                disabled={submitting || running}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {submitting ? (
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

export default AssignmentDetails;
