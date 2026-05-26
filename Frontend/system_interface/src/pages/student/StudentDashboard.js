import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/authSlice';
import { assignmentApi, submissionApi } from '../../api/api';
import Sidebar from '../../components/Sidebar';

export default function StudentDashboard() {
  const user = useSelector(selectUser);
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [stats, setStats] = useState({ total: 0, accepted: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [aRes, sRes] = await Promise.all([
          assignmentApi.list({ status: 'published' }),
          submissionApi.history(),
        ]);
        setAssignments(aRes.data.results || aRes.data);
        const subs = sRes.data.results || sRes.data;
        setStats({
          total: subs.length,
          accepted: subs.filter(s => s.status === 'accepted').length,
          pending: subs.filter(s => ['pending', 'queued', 'running'].includes(s.status)).length,
        });
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="loading-screen"><span className="spinner" /><span>Loading...</span></div>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="topbar">
          <span style={{fontWeight:700,fontSize:16}}>Student Portal</span>
          <span style={{marginLeft:'auto',fontSize:13,color:'var(--clr-text-2)'}}>
            Welcome, {user?.first_name || user?.username}
          </span>
        </div>
        <div className="page-body">
          <div className="page-header">
            <h1 className="page-title">My Dashboard</h1>
            <p className="page-subtitle">Track your assignments and submissions</p>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            {[
              { label:'Active Assignments', value: assignments.length, icon:'📚', color:'var(--clr-accent)' },
              { label:'Total Submissions',  value: stats.total,       icon:'📤', color:'var(--clr-info)' },
              { label:'Accepted',           value: stats.accepted,    icon:'✅', color:'var(--clr-success)' },
              { label:'In Progress',        value: stats.pending,     icon:'⏳', color:'var(--clr-warning)' },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{'--stat-accent': s.color}}>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{color: s.color}}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Assignment Cards */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Active Assignments</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/student/assignments')}>View All →</button>
          </div>

          {assignments.length === 0 ? (
            <div className="card" style={{textAlign:'center',padding:48}}>
              <div style={{fontSize:48,marginBottom:16}}>📭</div>
              <div style={{color:'var(--clr-text-2)'}}>No active assignments right now.</div>
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:20}}>
              {assignments.map(a => (
                <AssignmentCard key={a.id} assignment={a} onOpen={() => navigate(`/student/assignments/${a.id}`)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AssignmentCard({ assignment, onOpen }) {
  const isPast = assignment.due_date && new Date(assignment.due_date) < new Date();
  return (
    <div className="card card--glow" style={{cursor:'pointer'}} onClick={onOpen}>
      <div className="flex items-center justify-between mb-2">
        <span className={`badge ${isPast ? 'badge-error' : 'badge-success'}`}>
          {isPast ? 'Expired' : 'Active'}
        </span>
        <span style={{fontSize:12,color:'var(--clr-text-3)'}}>
          {assignment.problem_count} problem{assignment.problem_count !== 1 ? 's' : ''}
        </span>
      </div>
      <h3 style={{fontWeight:700,marginBottom:6,fontSize:15}}>{assignment.title}</h3>
      <p style={{fontSize:13,color:'var(--clr-text-2)',marginBottom:12,
        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
        {assignment.description || 'No description'}
      </p>
      <div className="flex items-center justify-between" style={{fontSize:12}}>
        <span style={{color:'var(--clr-text-3)'}}>⏱ {assignment.time_limit_minutes} min</span>
        {assignment.due_date && (
          <span style={{color: isPast ? 'var(--clr-error)' : 'var(--clr-text-3)'}}>
            Due: {new Date(assignment.due_date).toLocaleDateString()}
          </span>
        )}
      </div>
      <button className="btn btn-primary w-full btn-sm" style={{marginTop:14}}>
        Start Assignment →
      </button>
    </div>
  );
}
