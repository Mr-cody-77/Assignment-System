import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/authSlice';
import { assignmentApi, submissionApi, nodeApi } from '../../api/api';
import Sidebar from '../../components/Sidebar';

export default function TeacherDashboard() {
  const user = useSelector(selectUser);
  const navigate = useNavigate();
  const [stats, setStats] = useState({ assignments: 0, students: 0, submissions: 0, nodes: 0 });
  const [recentSubs, setRecentSubs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      assignmentApi.list(),
      submissionApi.list({ page_size: 10 }),
      nodeApi.list(),
    ]).then(([aRes, sRes, nRes]) => {
      const assignments = aRes.data.results || aRes.data;
      const subs = sRes.data.results || sRes.data;
      const nodes = nRes.data.results || nRes.data;
      setStats({
        assignments: assignments.length,
        submissions: sRes.data.count || subs.length,
        nodes: nodes.filter(n => n.status === 'online').length,
        students: [...new Set(subs.map(s => s.student_roll).filter(Boolean))].length,
      });
      setRecentSubs(subs.slice(0, 8));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const STATUS_BADGE = {
    accepted:   'badge-success', pending: 'badge-neutral', queued: 'badge-neutral',
    running:    'badge-info',    wrong_answer: 'badge-error', failed: 'badge-error',
    time_limit_exceeded: 'badge-warning', compilation_error: 'badge-error',
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="topbar" style={{justifyContent:'space-between'}}>
          <span style={{fontWeight:700}}>Teacher Portal</span>
          <span style={{fontSize:13,color:'var(--clr-text-2)'}}>Prof. {user?.first_name || user?.username}</span>
        </div>
        <div className="page-body">
          <div className="page-header">
            <h1 className="page-title">Teacher Dashboard</h1>
            <p className="page-subtitle">Manage assignments, monitor students, analyze performance</p>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            {[
              { label:'My Assignments', value: stats.assignments, icon:'📚', color:'var(--clr-accent)',  action: () => navigate('/teacher/assignments') },
              { label:'Online Nodes',   value: stats.nodes,       icon:'🖥',  color:'var(--clr-success)', action: () => navigate('/teacher/nodes') },
              { label:'Submissions',    value: stats.submissions,  icon:'📤', color:'var(--clr-info)',    action: () => navigate('/teacher/submissions') },
              { label:'Active Students',value: stats.students,    icon:'🎓',  color:'var(--clr-warning)', action: null },
            ].map(s => (
              <div
                key={s.label}
                className="stat-card"
                style={{'--stat-accent': s.color, cursor: s.action ? 'pointer' : 'default'}}
                onClick={s.action}
              >
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{color: s.color}}>{loading ? '—' : s.value}</div>
                {s.action && <div style={{fontSize:12,color:'var(--clr-text-3)',marginTop:4}}>Click to view →</div>}
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-3 mb-8">
            <button id="btn-create-assignment" className="btn btn-primary" onClick={() => navigate('/teacher/assignments?new=1')}>
              + Create Assignment
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/teacher/nodes')}>
              🖥 Node Monitor
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/teacher/analytics')}>
              📊 Analytics
            </button>
          </div>

          {/* Recent Submissions */}
          <div className="flex items-center justify-between mb-4">
            <h2 style={{fontWeight:700}}>Recent Submissions</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/teacher/submissions')}>View All →</button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Roll No.</th>
                  <th>Problem</th>
                  <th>Language</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Node</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{textAlign:'center',padding:24}}><span className="spinner" /></td></tr>
                ) : recentSubs.length === 0 ? (
                  <tr><td colSpan={8} style={{textAlign:'center',padding:24,color:'var(--clr-text-3)'}}>No submissions yet.</td></tr>
                ) : recentSubs.map(s => (
                  <tr key={s.id}>
                    <td style={{fontWeight:600}}>{s.student_name}</td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--clr-text-2)'}}>{s.student_roll||'—'}</td>
                    <td style={{fontSize:13}}>{s.problem_title}</td>
                    <td><span className="badge badge-neutral" style={{fontFamily:'var(--font-mono)'}}>{s.language}</span></td>
                    <td><span className={`badge ${STATUS_BADGE[s.status]||'badge-neutral'}`}>{s.status}</span></td>
                    <td style={{fontWeight:700,color:'var(--clr-accent-light)'}}>{s.score}/{s.total_score}</td>
                    <td style={{fontSize:11,fontFamily:'var(--font-mono)',color:'var(--clr-text-3)'}}>{s.execution_node||'—'}</td>
                    <td style={{fontSize:12,color:'var(--clr-text-3)'}}>{new Date(s.submitted_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
