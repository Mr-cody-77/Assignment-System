import React, { useEffect, useState } from 'react';
import { submissionApi } from '../../api/api';
import Sidebar from '../../components/Sidebar';

const STATUS_MAP = {
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

export default function SubmissionHistory() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    submissionApi.history()
      .then(r => setSubmissions(r.data.results || r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="topbar"><span style={{fontWeight:700}}>My Submissions</span></div>
        <div className="page-body">
          <div className="page-header">
            <h1 className="page-title">Submission History</h1>
            <p className="page-subtitle">{submissions.length} submission{submissions.length !== 1 ? 's' : ''} total</p>
          </div>

          {loading ? (
            <div className="loading-screen" style={{minHeight:300}}><span className="spinner" /></div>
          ) : submissions.length === 0 ? (
            <div className="card" style={{textAlign:'center',padding:60}}>
              <div style={{fontSize:48,marginBottom:12}}>📭</div>
              <div style={{color:'var(--clr-text-2)'}}>No submissions yet. Go solve some problems!</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Problem</th>
                    <th>Language</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Execution Node</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s, i) => {
                    const badge = STATUS_MAP[s.status] || { cls: 'badge-neutral', label: s.status };
                    return (
                      <tr key={s.id}>
                        <td style={{color:'var(--clr-text-3)',fontSize:13}}>{i+1}</td>
                        <td style={{fontWeight:600}}>{s.problem_title}</td>
                        <td>
                          <span className="badge badge-neutral" style={{fontFamily:'var(--font-mono)'}}>
                            {s.language}
                          </span>
                        </td>
                        <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                        <td style={{fontWeight:700,color:'var(--clr-accent-light)'}}>
                          {s.score}/{s.total_score}
                        </td>
                        <td style={{fontSize:12,fontFamily:'var(--font-mono)',color:'var(--clr-text-2)'}}>
                          {s.execution_node || '—'}
                        </td>
                        <td style={{fontSize:12,color:'var(--clr-text-3)'}}>
                          {new Date(s.submitted_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
