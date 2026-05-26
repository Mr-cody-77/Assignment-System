import React, { useEffect, useState } from 'react';
import { assignmentApi, problemApi, testCaseApi } from '../../api/api';
import Sidebar from '../../components/Sidebar';

const EMPTY_ASSIGNMENT = { title: '', description: '', time_limit_minutes: 90, status: 'draft', due_date: '' };
const EMPTY_PROBLEM = { title: '', statement: '', constraints: '', difficulty: 'medium', time_limit_ms: 2000, memory_limit_mb: 256, max_score: 100, allowed_languages: ['python','cpp','java','javascript'], examples: [] };
const EMPTY_TC = { input_data: '', expected_output: '', is_hidden: false, points: 10, order: 1 };

export default function AssignmentManager() {
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [problems, setProblems] = useState([]);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [testCases, setTestCases] = useState([]);
  const [tab, setTab] = useState('assignments'); // assignments | problems | testcases
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_ASSIGNMENT);
  const [problemForm, setProblemForm] = useState(EMPTY_PROBLEM);
  const [tcForm, setTcForm] = useState(EMPTY_TC);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  // Load assignments
  useEffect(() => {
    assignmentApi.list().then(r => setAssignments(r.data.results || r.data)).catch(() => {});
  }, []);

  const loadProblems = async (a) => {
    setSelected(a);
    const r = await problemApi.list({ assignment: a.id });
    setProblems(r.data.results || r.data);
    setTab('problems');
  };

  const loadTestCases = async (p) => {
    setSelectedProblem(p);
    const r = await testCaseApi.list({ problem: p.id });
    setTestCases(r.data.results || r.data);
    setTab('testcases');
  };

  // Create assignment
  const handleCreateAssignment = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const r = await assignmentApi.create(formData);
      setAssignments(prev => [r.data, ...prev]);
      setShowForm(false); setFormData(EMPTY_ASSIGNMENT);
      flash('Assignment created!');
    } catch (err) { flash('Error: ' + JSON.stringify(err.response?.data)); }
    finally { setLoading(false); }
  };

  const handlePublish = async (id) => {
    await assignmentApi.publish(id);
    setAssignments(prev => prev.map(a => a.id === id ? {...a, status:'published'} : a));
    flash('Assignment published!');
  };
  const handleClose = async (id) => {
    await assignmentApi.close(id);
    setAssignments(prev => prev.map(a => a.id === id ? {...a, status:'closed'} : a));
    flash('Assignment closed.');
  };

  // Create problem
  const handleCreateProblem = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const payload = { ...problemForm, assignment: selected.id };
      const r = await problemApi.create(payload);
      setProblems(prev => [...prev, r.data]);
      setProblemForm(EMPTY_PROBLEM);
      flash('Problem added!');
    } catch (err) { flash('Error: ' + JSON.stringify(err.response?.data)); }
    finally { setLoading(false); }
  };

  // Create test case
  const handleCreateTC = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const payload = { ...tcForm, problem: selectedProblem.id };
      const r = await testCaseApi.create(payload);
      setTestCases(prev => [...prev, r.data]);
      setTcForm({...EMPTY_TC, order: testCases.length + 2});
      flash('Test case added!');
    } catch (err) { flash('Error: ' + JSON.stringify(err.response?.data)); }
    finally { setLoading(false); }
  };

  const handleDeleteTC = async (id) => {
    if (!window.confirm('Delete this test case?')) return;
    await testCaseApi.delete(id);
    setTestCases(prev => prev.filter(t => t.id !== id));
    flash('Test case deleted.');
  };

  const STATUS_BADGE = { draft:'badge-neutral', published:'badge-success', closed:'badge-error' };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="topbar">
          <div className="flex items-center gap-3">
            {tab !== 'assignments' && (
              <button className="btn btn-ghost btn-sm" onClick={() => {
                if (tab === 'testcases') setTab('problems');
                else { setTab('assignments'); setSelected(null); }
              }}>← Back</button>
            )}
            <span style={{fontWeight:700}}>
              {tab === 'assignments' ? 'Manage Assignments' : tab === 'problems' ? `Problems — ${selected?.title}` : `Test Cases — ${selectedProblem?.title}`}
            </span>
          </div>
        </div>
        <div className="page-body">
          {msg && <div className="alert alert-success">{msg}</div>}

          {/* ── ASSIGNMENTS ── */}
          {tab === 'assignments' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h1 className="page-title">Assignments</h1>
                <button id="btn-new-assignment" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                  {showForm ? '✕ Cancel' : '+ New Assignment'}
                </button>
              </div>

              {showForm && (
                <div className="card mb-6">
                  <h3 style={{fontWeight:700,marginBottom:16}}>Create New Assignment</h3>
                  <form onSubmit={handleCreateAssignment}>
                    <div className="form-group">
                      <label className="form-label">Title *</label>
                      <input className="form-input" value={formData.title} onChange={e => setFormData({...formData, title:e.target.value})} required placeholder="e.g. Lab 1 — Arrays" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description:e.target.value})} placeholder="Assignment overview..." />
                    </div>
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Timer (minutes)</label>
                        <input type="number" className="form-input" value={formData.time_limit_minutes} onChange={e => setFormData({...formData, time_limit_minutes:+e.target.value})} min={5} max={480} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Due Date</label>
                        <input type="datetime-local" className="form-input" value={formData.due_date} onChange={e => setFormData({...formData, due_date:e.target.value})} />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? <><span className="spinner" /> Creating...</> : 'Create Assignment'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {assignments.length === 0 ? (
                <div className="card" style={{textAlign:'center',padding:60}}>
                  <div style={{fontSize:48,marginBottom:12}}>📝</div>
                  <div style={{color:'var(--clr-text-2)'}}>No assignments yet. Create your first one!</div>
                </div>
              ) : (
                <div style={{display:'grid',gap:12}}>
                  {assignments.map(a => (
                    <div key={a.id} className="card">
                      <div className="flex items-center justify-between">
                        <div style={{flex:1}}>
                          <div className="flex items-center gap-3 mb-1">
                            <span style={{fontWeight:700,fontSize:16}}>{a.title}</span>
                            <span className={`badge ${STATUS_BADGE[a.status]||'badge-neutral'}`}>{a.status}</span>
                          </div>
                          <div style={{fontSize:13,color:'var(--clr-text-2)'}}>{a.problem_count} problems · {a.time_limit_minutes} min</div>
                        </div>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-sm" onClick={() => loadProblems(a)}>Manage Problems</button>
                          {a.status === 'draft' && (
                            <button className="btn btn-success btn-sm" onClick={() => handlePublish(a.id)}>▶ Publish</button>
                          )}
                          {a.status === 'published' && (
                            <button className="btn btn-danger btn-sm" onClick={() => handleClose(a.id)}>■ Close</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── PROBLEMS ── */}
          {tab === 'problems' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h1 className="page-title">Problems</h1>
              </div>

              {/* Add Problem Form */}
              <div className="card mb-6">
                <h3 style={{fontWeight:700,marginBottom:16}}>Add Problem</h3>
                <form onSubmit={handleCreateProblem}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Title *</label>
                      <input className="form-input" value={problemForm.title} onChange={e => setProblemForm({...problemForm, title:e.target.value})} required placeholder="e.g. Two Sum" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Difficulty</label>
                      <select className="form-select" value={problemForm.difficulty} onChange={e => setProblemForm({...problemForm, difficulty:e.target.value})}>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Problem Statement *</label>
                    <textarea className="form-textarea" style={{minHeight:120}} value={problemForm.statement} onChange={e => setProblemForm({...problemForm, statement:e.target.value})} required placeholder="Describe the problem clearly..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Constraints</label>
                    <textarea className="form-textarea" value={problemForm.constraints} onChange={e => setProblemForm({...problemForm, constraints:e.target.value})} placeholder="1 ≤ n ≤ 10^5 ..." />
                  </div>
                  <div className="grid-3">
                    <div className="form-group">
                      <label className="form-label">Time Limit (ms)</label>
                      <input type="number" className="form-input" value={problemForm.time_limit_ms} onChange={e => setProblemForm({...problemForm, time_limit_ms:+e.target.value})} min={100} max={30000} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Memory Limit (MB)</label>
                      <input type="number" className="form-input" value={problemForm.memory_limit_mb} onChange={e => setProblemForm({...problemForm, memory_limit_mb:+e.target.value})} min={32} max={512} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Max Score</label>
                      <input type="number" className="form-input" value={problemForm.max_score} onChange={e => setProblemForm({...problemForm, max_score:+e.target.value})} min={1} />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? <><span className="spinner" /> Adding...</> : '+ Add Problem'}
                  </button>
                </form>
              </div>

              {/* Problem List */}
              {problems.map((p, i) => (
                <div key={p.id} className="card mb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span style={{fontWeight:700}}>{i+1}. {p.title}</span>
                      <span className={`badge badge-${p.difficulty==='easy'?'success':p.difficulty==='hard'?'error':'warning'} ml-2`} style={{marginLeft:8}}>{p.difficulty}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="badge badge-neutral">{p.time_limit_ms}ms</span>
                      <span className="badge badge-neutral">{p.max_score}pts</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => loadTestCases(p)}>Test Cases</button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── TEST CASES ── */}
          {tab === 'testcases' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h1 className="page-title">Test Cases</h1>
                <div className="flex gap-2">
                  <span className="badge badge-success">{testCases.filter(t=>!t.is_hidden).length} visible</span>
                  <span className="badge badge-neutral">{testCases.filter(t=>t.is_hidden).length} hidden</span>
                </div>
              </div>

              {/* Add TC Form */}
              <div className="card mb-6">
                <h3 style={{fontWeight:700,marginBottom:16}}>Add Test Case</h3>
                <form onSubmit={handleCreateTC}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Input Data *</label>
                      <textarea className="form-textarea" value={tcForm.input_data} onChange={e => setTcForm({...tcForm, input_data:e.target.value})} required placeholder="5&#10;1 2 3 4 5" style={{fontFamily:'var(--font-mono)',fontSize:13}} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Expected Output *</label>
                      <textarea className="form-textarea" value={tcForm.expected_output} onChange={e => setTcForm({...tcForm, expected_output:e.target.value})} required placeholder="15" style={{fontFamily:'var(--font-mono)',fontSize:13}} />
                    </div>
                  </div>
                  <div className="flex gap-4 items-center">
                    <div className="form-group" style={{flex:'0 0 100px',marginBottom:0}}>
                      <label className="form-label">Points</label>
                      <input type="number" className="form-input" value={tcForm.points} onChange={e => setTcForm({...tcForm, points:+e.target.value})} min={1} />
                    </div>
                    <div className="form-group" style={{flex:'0 0 60px',marginBottom:0}}>
                      <label className="form-label">Order</label>
                      <input type="number" className="form-input" value={tcForm.order} onChange={e => setTcForm({...tcForm, order:+e.target.value})} min={1} />
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:16}}>
                      <input type="checkbox" id="tc-hidden" checked={tcForm.is_hidden} onChange={e => setTcForm({...tcForm, is_hidden:e.target.checked})} style={{width:16,height:16}} />
                      <label htmlFor="tc-hidden" style={{fontSize:13,fontWeight:600,color:'var(--clr-text-2)'}}>Hidden</label>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{marginTop:16}} disabled={loading}>
                      {loading ? <><span className="spinner" /> Adding...</> : '+ Add Test Case'}
                    </button>
                  </div>
                </form>
              </div>

              {/* TC List */}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>Input</th><th>Expected Output</th><th>Points</th><th>Type</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testCases.length === 0 ? (
                      <tr><td colSpan={6} style={{textAlign:'center',padding:24,color:'var(--clr-text-3)'}}>No test cases yet.</td></tr>
                    ) : testCases.map(tc => (
                      <tr key={tc.id}>
                        <td style={{fontWeight:700}}>{tc.order}</td>
                        <td style={{fontFamily:'var(--font-mono)',fontSize:12,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tc.input_data}</td>
                        <td style={{fontFamily:'var(--font-mono)',fontSize:12,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tc.expected_output}</td>
                        <td><span className="badge badge-neutral">{tc.points}</span></td>
                        <td><span className={`badge ${tc.is_hidden ? 'badge-neutral' : 'badge-info'}`}>{tc.is_hidden ? '🔒 Hidden' : '👁 Visible'}</span></td>
                        <td><button className="btn btn-danger btn-sm" onClick={() => handleDeleteTC(tc.id)}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
