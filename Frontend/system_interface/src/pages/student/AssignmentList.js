import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { assignmentApi, problemApi } from '../../api/api';
import Sidebar from '../../components/Sidebar';

export default function AssignmentList() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [problems, setProblems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    assignmentApi.list({ status: 'published' })
      .then(r => setAssignments(r.data.results || r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openAssignment = async (a) => {
    setSelected(a);
    const r = await problemApi.list({ assignment: a.id });
    setProblems(r.data.results || r.data);
  };

  if (loading) return (
    <div className="app-shell"><Sidebar />
      <div className="main-content">
        <div className="loading-screen"><span className="spinner" /></div>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="topbar">
          <span style={{fontWeight:700}}>My Assignments</span>
        </div>
        <div className="page-body">
          {!selected ? (
            <>
              <div className="page-header">
                <h1 className="page-title">Active Assignments</h1>
                <p className="page-subtitle">{assignments.length} assignment{assignments.length !== 1 ? 's' : ''} available</p>
              </div>
              {assignments.length === 0 ? (
                <div className="card" style={{textAlign:'center',padding:60}}>
                  <div style={{fontSize:48,marginBottom:12}}>📭</div>
                  <div style={{color:'var(--clr-text-2)'}}>No assignments available yet.</div>
                </div>
              ) : (
                <div style={{display:'grid',gap:16}}>
                  {assignments.map(a => (
                    <div key={a.id} className="card" style={{cursor:'pointer'}} onClick={() => openAssignment(a)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>{a.title}</div>
                          <div style={{color:'var(--clr-text-2)',fontSize:13}}>{a.description}</div>
                        </div>
                        <div style={{textAlign:'right',flexShrink:0,marginLeft:16}}>
                          <div style={{fontSize:22,fontWeight:800,color:'var(--clr-accent-light)'}}>{a.problem_count}</div>
                          <div style={{fontSize:12,color:'var(--clr-text-3)'}}>problems</div>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-4" style={{fontSize:12,color:'var(--clr-text-3)'}}>
                        <span>⏱ {a.time_limit_minutes} min</span>
                        {a.due_date && <span>📅 Due: {new Date(a.due_date).toLocaleString()}</span>}
                        <span>👤 {a.created_by_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(null); setProblems([]); }}>← Back</button>
                <h1 className="page-title" style={{marginBottom:0}}>{selected.title}</h1>
              </div>
              <div style={{display:'grid',gap:12}}>
                {problems.map((p, i) => (
                  <div key={p.id} className="card" style={{cursor:'pointer'}} onClick={() => navigate(`/student/problem/${p.id}`)}>
                    <div className="flex items-center gap-4">
                      <div style={{fontWeight:800,fontSize:20,color:'var(--clr-accent-light)',width:32}}>{i+1}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,marginBottom:4}}>{p.title}</div>
                        <div style={{fontSize:13,color:'var(--clr-text-2)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                          {p.statement?.slice(0,120)}...
                        </div>
                      </div>
                      <div className="flex gap-2" style={{flexShrink:0}}>
                        <span className={`badge badge-${p.difficulty==='easy'?'success':p.difficulty==='hard'?'error':'warning'}`}>
                          {p.difficulty}
                        </span>
                        <span className="badge badge-neutral">🏆 {p.max_score}pts</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
