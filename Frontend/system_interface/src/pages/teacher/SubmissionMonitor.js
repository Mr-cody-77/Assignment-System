import React, { useEffect, useState, useRef, useCallback } from 'react';
import { submissionApi } from '../../api/api';
import Sidebar from '../../components/Sidebar';

const STATUS_BADGE = {
  accepted:             { cls: 'badge-success', label: '✅ Accepted' },
  pending:              { cls: 'badge-neutral', label: '⏳ Pending' },
  queued:               { cls: 'badge-neutral', label: '🔄 Queued' },
  running:              { cls: 'badge-info',    label: '⚡ Running' },
  wrong_answer:         { cls: 'badge-error',   label: '❌ Wrong Answer' },
  time_limit_exceeded:  { cls: 'badge-warning', label: '⏱ TLE' },
  memory_limit_exceeded:{ cls: 'badge-warning', label: '💾 MLE' },
  runtime_error:        { cls: 'badge-error',   label: '💥 Runtime Error' },
  compilation_error:    { cls: 'badge-error',   label: '🔧 Compile Error' },
  failed:               { cls: 'badge-error',   label: '✗ Failed' },
};

export default function SubmissionMonitor() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ student: '', status: '', roll_number: '' });
  const [selected, setSelected] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const params = {};
      if (filter.student) params.student = filter.student;
      if (filter.status) params.status = filter.status;
      if (filter.roll_number) params.roll_number = filter.roll_number;
      const r = await submissionApi.list(params);
      setSubmissions(r.data.results || r.data);
    } catch {} finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 5000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, load]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="topbar" style={{justifyContent:'space-between'}}>
          <span style={{fontWeight:700}}>Submission Monitor</span>
          <div className="flex items-center gap-3">
            <span style={{fontSize:12,color:'var(--clr-text-3)'}}>
              {submissions.length} submissions
            </span>
            <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer'}}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              Auto-refresh (5s)
            </label>
            <button className="btn btn-ghost btn-sm" onClick={load}>↺ Refresh</button>
          </div>
        </div>
        <div className="page-body">
          <div className="page-header">
            <h1 className="page-title">All Submissions</h1>
          </div>

          {/* Filters */}
          <div className="card mb-6">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Search Student</label>
                <input
                  className="form-input"
                  placeholder="Name or username..."
                  value={filter.student}
                  onChange={e => setFilter({...filter, student:e.target.value})}
                />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Roll Number</label>
                <input
                  className="form-input"
                  placeholder="CS2024001..."
                  value={filter.roll_number}
                  onChange={e => setFilter({...filter, roll_number:e.target.value})}
                />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Status</label>
                <select className="form-select" value={filter.status} onChange={e => setFilter({...filter, status:e.target.value})}>
                  <option value="">All Status</option>
                  {Object.keys(STATUS_BADGE).map(s => <option key={s} value={s}>{STATUS_BADGE[s].label}</option>)}
                </select>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm mt-4" onClick={() => setFilter({student:'',status:'',roll_number:''})}>
              Clear Filters
            </button>
          </div>

          {/* Summary Stats */}
          <div style={{display:'flex',gap:12,marginBottom:24,flexWrap:'wrap'}}>
            {[
              { label:'Total', count: submissions.length, cls:'badge-neutral' },
              { label:'Accepted', count: submissions.filter(s=>s.status==='accepted').length, cls:'badge-success' },
              { label:'Wrong Answer', count: submissions.filter(s=>s.status==='wrong_answer').length, cls:'badge-error' },
              { label:'Running', count: submissions.filter(s=>['pending','queued','running'].includes(s.status)).length, cls:'badge-info' },
            ].map(stat => (
              <div key={stat.label} style={{background:'var(--clr-surface)',border:'1px solid var(--clr-border)',borderRadius:8,padding:'8px 16px'}}>
                <span style={{fontSize:12,color:'var(--clr-text-3)'}}>{stat.label}: </span>
                <span style={{fontWeight:700,fontSize:16}}>{stat.count}</span>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th><th>Roll No.</th><th>Problem</th>
                  <th>Lang</th><th>Status</th><th>Score</th>
                  <th>Passed TC</th><th>Exec Node</th><th>Time</th><th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} style={{textAlign:'center',padding:24}}><span className="spinner" /></td></tr>
                ) : submissions.length === 0 ? (
                  <tr><td colSpan={10} style={{textAlign:'center',padding:24,color:'var(--clr-text-3)'}}>No submissions match your filters.</td></tr>
                ) : submissions.map(s => {
                  const badge = STATUS_BADGE[s.status] || { cls:'badge-neutral', label:s.status };
                  return (
                    <tr key={s.id} style={{cursor:'pointer'}} onClick={() => setSelected(selected?.id===s.id?null:s)}>
                      <td style={{fontWeight:600}}>{s.student_name}</td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--clr-text-2)'}}>{s.student_roll||'—'}</td>
                      <td style={{fontSize:13}}>{s.problem_title}</td>
                      <td><span className="badge badge-neutral" style={{fontFamily:'var(--font-mono)'}}>{s.language}</span></td>
                      <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                      <td style={{fontWeight:700,color:'var(--clr-accent-light)'}}>{s.score}/{s.total_score}</td>
                      <td>{s.passed_count != null ? `${s.passed_count}` : '—'}</td>
                      <td style={{fontSize:11,fontFamily:'var(--font-mono)',color:'var(--clr-text-3)'}}>{s.execution_node||'—'}</td>
                      <td style={{fontSize:11,color:'var(--clr-text-3)'}}>{new Date(s.submitted_at).toLocaleString()}</td>
                      <td><button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();setSelected(selected?.id===s.id?null:s);}}>
                        {selected?.id===s.id?'▲':'▼'}
                      </button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Inline Detail Panel */}
          {selected && <SubmissionDetail submission={selected} />}
        </div>
      </div>
    </div>
  );
}

function SubmissionDetail({ submission }) {
  const [detail, setDetail] = useState(null);
  useEffect(() => {
    submissionApi.get(submission.id).then(r => setDetail(r.data)).catch(() => {});
  }, [submission.id]);

  if (!detail) return <div className="card mt-4"><span className="spinner" /></div>;

  return (
    <div className="card mt-4" style={{borderTop:'2px solid var(--clr-accent)'}}>
      <h3 style={{fontWeight:700,marginBottom:12}}>Submission Detail — {detail.student_name} ({detail.student_roll})</h3>
      <div className="flex gap-4 mb-4" style={{fontSize:13,flexWrap:'wrap'}}>
        <span>Code: <strong style={{fontFamily:'var(--font-mono)'}}>{detail.language}</strong></span>
        <span>Score: <strong style={{color:'var(--clr-accent-light)'}}>{detail.score}/{detail.total_score}</strong></span>
        <span>Node: <strong style={{fontFamily:'var(--font-mono)'}}>{detail.execution_node||'—'}</strong></span>
        {detail.completed_at && <span>Completed: <strong>{new Date(detail.completed_at).toLocaleString()}</strong></span>}
      </div>

      {/* Test Case Results */}
      {detail.results?.length > 0 && (
        <>
          <div style={{fontWeight:700,marginBottom:8,fontSize:13}}>Test Case Results</div>
          <div className="tc-grid">
            {detail.results.map((r,i) => (
              <div key={i} className={`tc-card ${r.passed?'pass':'fail'}`}>
                <div className="tc-number">TC {r.test_case_order} {r.is_hidden?'🔒':''}</div>
                <div style={{fontWeight:700,fontSize:13}}>{r.passed?'✅':'❌'}</div>
                <div style={{fontSize:11,color:'var(--clr-text-2)',marginTop:4}}>
                  {r.exec_time_ms?.toFixed(1)}ms
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Code */}
      <details style={{marginTop:16}}>
        <summary style={{cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--clr-text-2)'}}>View Submitted Code</summary>
        <pre style={{marginTop:8,padding:12,background:'var(--clr-bg)',borderRadius:8,fontSize:12,fontFamily:'var(--font-mono)',overflow:'auto',maxHeight:300,whiteSpace:'pre-wrap'}}>
          {detail.code}
        </pre>
      </details>
    </div>
  );
}
