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
import { submitTask } from '../../services/taskService';
import { runVisibleTestCases } from '../../services/localExecutionService';
import Timer from '../../components/Timer/Timer';
import { submitTest } from '../../services/testService';
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

  const [code, setCode] = useState(TEMPLATES.python);
  const [language, setLanguage] = useState('python');
  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const [activeTab, setActiveTab] = useState('description');

  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedTaskId, setSubmittedTaskId] = useState(null);
  const [terminalResults, setTerminalResults] = useState(null);

  const examActive = localStorage.getItem('exam_active') === 'true';
  const examDuration = parseInt(localStorage.getItem('exam_duration') || '60', 10);

  const handleExamEnd = async () => {
    try {
      // Submit the test formally
      const testId = localStorage.getItem('exam_test_id');
      if (testId) {
        await submitTest(testId);
      }
    } catch (err) {
      console.error('Failed to submit test:', err);
    }
    localStorage.removeItem('exam_active');
    localStorage.removeItem('exam_duration');
    localStorage.removeItem('exam_end_time');
    localStorage.removeItem('exam_test_id');
    navigate('/student');
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

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    // Apply template if code is empty or is still a template
    if (!code || Object.values(TEMPLATES).includes(code)) {
      setCode(TEMPLATES[lang] || '');
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
                onChange={setCode}
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
    </div>
  );
};

export default AssignmentDetails;
