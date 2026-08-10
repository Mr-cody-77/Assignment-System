import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { problemApi, submissionApi, draftApi } from '../../api/api';
import Sidebar from '../../components/Sidebar';

loader.config({ monaco });

const LANGUAGES = [
  { value: 'python',     label: 'Python 3',    monaco: 'python',     starter: '# Write your Python solution here\n\ndef solve():\n    pass\n\nsolve()\n' },
  { value: 'cpp',        label: 'C / C++',        monaco: 'cpp',        starter: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Read input from stdin (e.g. cin >> a >> b;)\n    // Print output to stdout (e.g. cout << result << endl;)\n    // Your solution here\n    \n    return 0;\n}\n' },
  { value: 'java',       label: 'Java 17',      monaco: 'java',       starter: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Your solution\n    }\n}\n' },
  { value: 'javascript', label: 'JavaScript',   monaco: 'javascript', starter: 'const readline = require("readline");\nconst rl = readline.createInterface({ input: process.stdin });\nlet lines = [];\nrl.on("line", l => lines.push(l));\nrl.on("close", () => {\n    // Your solution using lines[]\n});\n' },
];

const STATUS_BADGE = {
  pending:              { cls: 'badge-neutral', label: '⏳ Pending' },
  queued:               { cls: 'badge-neutral', label: '🔄 Queued' },
  running:              { cls: 'badge-info',    label: '⚡ Running' },
  accepted:             { cls: 'badge-success', label: '✅ Accepted' },
  wrong_answer:         { cls: 'badge-error',   label: '❌ Wrong Answer' },
  time_limit_exceeded:  { cls: 'badge-warning', label: '⏱ TLE' },
  memory_limit_exceeded:{ cls: 'badge-warning', label: '💾 MLE' },
  runtime_error:        { cls: 'badge-error',   label: '💥 Runtime Error' },
  compilation_error:    { cls: 'badge-error',   label: '🔧 Compile Error' },
  failed:               { cls: 'badge-error',   label: '✗ Failed' },
};

export default function CodingInterface() {
  const { problemId } = useParams();
  const navigate = useNavigate();

  const [problem, setProblem] = useState(null);
  const [lang, setLang] = useState('python');
  const [code, setCode] = useState(LANGUAGES[0].starter);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState(null);
  const [activeResult, setActiveResult] = useState('output');
  const [activeTC, setActiveTC] = useState(null);
  const [timerSec, setTimerSec] = useState(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const pollRef = useRef(null);
  const draftRef = useRef(null);

  // Load problem
  useEffect(() => {
    problemApi.get(problemId).then(r => {
      setProblem(r.data);
      const allowed = r.data.allowed_languages || [];
      if (allowed.length > 0 && !allowed.includes(lang)) setLang(allowed[0]);
    }).catch(e => console.error(e));
  }, [problemId]);

  // Load draft
  useEffect(() => {
    draftApi.get(problemId).then(r => {
      if (r.data?.code) setCode(r.data.code);
      if (r.data?.language) setLang(r.data.language);
    }).catch(() => {});
  }, [problemId]);

  // Auto-save draft every 5s
  useEffect(() => {
    draftRef.current = setTimeout(async () => {
      try {
        await draftApi.save(problemId, { code, language: lang });
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 2000);
      } catch {}
    }, 5000);
    return () => clearTimeout(draftRef.current);
  }, [code, lang, problemId]);

  // Timer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (problem?.assignment?.time_limit_minutes) {
      const seconds = problem.assignment.time_limit_minutes * 60;
      setTimerSec(seconds);
      const t = setInterval(() => setTimerSec(s => s > 0 ? s - 1 : 0), 1000);
      return () => clearInterval(t);
    }
  }, [problem]);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return [h > 0 ? String(h).padStart(2, '0') : null, String(m).padStart(2, '0'), String(sec).padStart(2, '0')]
      .filter(Boolean).join(':');
  };

  // Poll submission status
  const pollSubmission = useCallback((subId) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const { data } = await submissionApi.get(subId);
        setSubmission(data);
        const done = !['pending','queued','running'].includes(data.status);
        if (done || attempts >= 60) {
          clearInterval(pollRef.current);
          setSubmitting(false);
        }
      } catch {}
    }, 2000);
  }, []);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const handleSubmit = async () => {
    if (!problem) return;
    setSubmitting(true);
    setSubmission(null);
    try {
      const { data } = await submissionApi.submit({ problem: problem.id, language: lang, code });
      setSubmission(data);
      setActiveResult('results');
      if (['pending','queued','running'].includes(data.status)) pollSubmission(data.id);
      else setSubmitting(false);
    } catch (e) {
      setSubmitting(false);
      alert('Submission failed: ' + (e.response?.data?.error || e.message));
    }
  };

  const currentLangConfig = LANGUAGES.find(l => l.value === lang) || LANGUAGES[0];

  if (!problem) return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="loading-screen"><span className="spinner" /></div>
      </div>
    </div>
  );

  const timerClass = timerSec !== null && timerSec < 300 ? 'danger' : timerSec !== null && timerSec < 600 ? 'warning' : '';

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content" style={{height:'100vh',overflow:'hidden'}}>
        {/* Topbar */}
        <div className="topbar" style={{justifyContent:'space-between'}}>
          <div className="flex items-center gap-3">
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
            <span style={{fontWeight:700}}>{problem.title}</span>
            <span className={`badge badge-${problem.difficulty === 'easy' ? 'success' : problem.difficulty === 'hard' ? 'error' : 'warning'}`}>
              {problem.difficulty}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {draftSaved && <span style={{fontSize:12,color:'var(--clr-success)'}}>✓ Draft saved</span>}
            {timerSec !== null && (
              <div className={`timer-display ${timerClass}`}>
                ⏱ {formatTime(timerSec)}
              </div>
            )}
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="coding-layout" style={{height:'calc(100vh - var(--topbar-h))'}}>
          {/* LEFT — Problem Panel */}
          <div className="problem-panel">
            <h1 className="problem-title">{problem.title}</h1>
            <div className="problem-meta">
              <span className="badge badge-neutral">⏱ {problem.time_limit_ms}ms</span>
              <span className="badge badge-neutral">💾 {problem.memory_limit_mb}MB</span>
              <span className="badge badge-neutral">🏆 {problem.max_score} pts</span>
            </div>

            <div className="problem-section">
              <h3>Problem Statement</h3>
              <div style={{lineHeight:1.8,fontSize:14,whiteSpace:'pre-wrap'}}>{problem.statement}</div>
            </div>

            {problem.constraints && (
              <div className="problem-section">
                <h3>Constraints</h3>
                <div className="example-block" style={{whiteSpace:'pre-wrap'}}>{problem.constraints}</div>
              </div>
            )}

            {problem.examples?.length > 0 && (
              <div className="problem-section">
                <h3>Examples</h3>
                {problem.examples.map((ex, i) => (
                  <div key={i} style={{marginBottom:12}}>
                    <div className="example-label">Example {i + 1}</div>
                    <div className="example-block">
                      <div style={{marginBottom:8}}><strong style={{color:'var(--clr-text-2)'}}>Input:</strong><br/>{ex.input}</div>
                      <div style={{marginBottom: ex.explanation ? 8 : 0}}><strong style={{color:'var(--clr-text-2)'}}>Output:</strong><br/>{ex.output}</div>
                      {ex.explanation && <div style={{color:'var(--clr-text-2)',marginTop:4,fontSize:13}}>💡 {ex.explanation}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Visible test cases */}
            {problem.test_cases?.filter(tc => !tc.is_hidden).length > 0 && (
              <div className="problem-section">
                <h3>Sample Test Cases</h3>
                {problem.test_cases.filter(tc => !tc.is_hidden).map((tc, i) => (
                  <div key={tc.id} className="example-block" style={{marginBottom:8}}>
                    <div className="example-label">Test {i + 1}</div>
                    <div><strong style={{color:'var(--clr-text-2)'}}>Input:</strong><br/><pre style={{margin:'4px 0'}}>{tc.input_data}</pre></div>
                    <div><strong style={{color:'var(--clr-text-2)'}}>Expected:</strong><br/><pre style={{margin:'4px 0'}}>{tc.expected_output}</pre></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — Editor Panel */}
          <div className="editor-panel">
            {/* Toolbar */}
            <div className="editor-toolbar">
              <select
                id="lang-selector"
                className="form-select"
                style={{width:'auto',padding:'6px 12px'}}
                value={lang}
                onChange={e => {
                  const newLang = e.target.value;
                  const newStarter = LANGUAGES.find(l => l.value === newLang)?.starter || '';
                  
                  const isDirty = code && !LANGUAGES.map(l => l.starter).includes(code);
                  if (isDirty) {
                    if (!window.confirm("Changing the language will delete your current code. Are you sure you want to proceed?")) {
                      return;
                    }
                  }
                  
                  setLang(newLang);
                  setCode(newStarter);
                }}
              >
                {LANGUAGES.filter(l => !problem.allowed_languages?.length || problem.allowed_languages.includes(l.value))
                  .map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>

              <button
                id="btn-reset-code"
                className="btn btn-ghost btn-sm"
                onClick={() => { if(window.confirm('Reset code to template?')) setCode(currentLangConfig.starter); }}
              >↺ Reset</button>

              <div style={{marginLeft:'auto', display:'flex', gap:8}}>
                <button
                  id="btn-submit"
                  className="btn btn-primary btn-sm"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? <><span className="spinner" style={{width:14,height:14}} /> Running...</> : '▶ Submit'}
                </button>
              </div>
            </div>

            {/* Monaco Editor */}
            <div className="editor-container">
              <Editor
                height="100%"
                language={currentLangConfig.monaco}
                value={code}
                onChange={v => setCode(v || '')}
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontLigatures: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  renderLineHighlight: 'all',
                  tabSize: 4,
                  insertSpaces: true,
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                  bracketPairColorization: { enabled: true },
                }}
              />
            </div>

            {/* Result Panel */}
            <div className="result-panel">
              <div className="result-tabs">
                {['output', 'results', 'logs'].map(tab => (
                  <button
                    key={tab}
                    className={`result-tab${activeResult === tab ? ' active' : ''}`}
                    onClick={() => setActiveResult(tab)}
                  >
                    {tab === 'output' && '📤 Output'}
                    {tab === 'results' && `🧪 Test Cases${submission ? ` (${submission.passed_count || 0}/${(submission.passed_count||0)+(submission.failed_count||0)})` : ''}`}
                    {tab === 'logs' && '📝 Logs'}
                  </button>
                ))}
                {submission && (
                  <span className={`badge ${STATUS_BADGE[submission.status]?.cls || 'badge-neutral'}`} style={{marginLeft:'auto',alignSelf:'center',marginRight:8}}>
                    {STATUS_BADGE[submission.status]?.label || submission.status}
                  </span>
                )}
              </div>
              <div className="result-body">
                {submitting && !submission && (
                  <div style={{display:'flex',alignItems:'center',gap:8,color:'var(--clr-text-2)'}}>
                    <span className="spinner" /> Submitting and evaluating...
                  </div>
                )}

                {activeResult === 'output' && submission && (
                  <div>
                    <div style={{marginBottom:8,fontSize:12,color:'var(--clr-text-3)'}}>
                      Score: <strong style={{color:'var(--clr-accent-light)'}}>{submission.score}/{submission.total_score}</strong>
                      {submission.execution_node && <span style={{marginLeft:12}}>Node: {submission.execution_node}</span>}
                    </div>
                    {submission.results?.[0]?.stdout && (
                      <pre style={{whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{submission.results[0].stdout}</pre>
                    )}
                    {submission.results?.[0]?.stderr && (
                      <pre style={{color:'var(--clr-error)',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{submission.results[0].stderr}</pre>
                    )}
                  </div>
                )}

                {activeResult === 'results' && submission?.results && (
                  <div>
                    <div className="tc-grid">
                      {submission.results.map((r, i) => (
                        <div
                          key={i}
                          className={`tc-card ${r.passed ? 'pass' : 'fail'}`}
                          onClick={() => setActiveTC(activeTC === i ? null : i)}
                        >
                          <div className="tc-number">Test {r.test_case_order || i+1} {r.is_hidden ? '🔒' : ''}</div>
                          <div style={{fontSize:13,fontWeight:700}}>{r.passed ? '✅ Passed' : '❌ Failed'}</div>
                          <div style={{fontSize:11,color:'var(--clr-text-2)',marginTop:4}}>
                            {r.exec_time_ms?.toFixed(1)}ms · {(r.memory_kb/1024).toFixed(1)}MB
                          </div>
                        </div>
                      ))}
                    </div>
                    {activeTC !== null && submission.results[activeTC] && (
                      <div style={{marginTop:12,padding:12,background:'var(--clr-bg)',borderRadius:8,border:'1px solid var(--clr-border)'}}>
                        <div style={{marginBottom:6,fontSize:12,fontWeight:700,color:'var(--clr-text-2)'}}>Test {activeTC+1} Details</div>
                        {submission.results[activeTC].stdout && (
                          <><div style={{fontSize:11,color:'var(--clr-text-3)'}}>stdout:</div>
                          <pre style={{whiteSpace:'pre-wrap',fontSize:12}}>{submission.results[activeTC].stdout}</pre></>
                        )}
                        {submission.results[activeTC].stderr && (
                          <><div style={{fontSize:11,color:'var(--clr-error)',marginTop:6}}>stderr:</div>
                          <pre style={{color:'var(--clr-error)',whiteSpace:'pre-wrap',fontSize:12}}>{submission.results[activeTC].stderr}</pre></>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeResult === 'logs' && submission?.logs && (
                  <div>
                    {submission.logs.map((log, i) => (
                      <div key={i} style={{fontSize:12,marginBottom:4,fontFamily:'var(--font-mono)'}}>
                        <span style={{color:'var(--clr-text-3)'}}>[{log.level}]</span>{' '}
                        <span>{log.log_text}</span>
                      </div>
                    ))}
                    {submission.logs.length === 0 && <span style={{color:'var(--clr-text-3)'}}>No logs.</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
