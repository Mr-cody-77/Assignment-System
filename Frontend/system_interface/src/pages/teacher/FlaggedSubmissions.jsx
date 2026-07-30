import React, { useState, useEffect } from 'react';
import { getTeacherPlagiarismFlags } from '../../services/plagiarismService';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import { useAuth } from '../../context/AuthContext';

const FlaggedSubmissions = () => {
  const { user } = useAuth();
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterRoll, setFilterRoll] = useState('');

  // Modal state
  const [selectedFlag, setSelectedFlag] = useState(null);

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    setLoading(true);
    try {
      const data = await getTeacherPlagiarismFlags();
      setFlags(data);
    } catch (error) {
      console.error("Error fetching flagged submissions", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFlags = flags.filter(flag => 
    flag.flagged_student_roll.toLowerCase().includes(filterRoll.toLowerCase())
  );

  return (
    <div className="app-shell">
      <Sidebar role="teacher" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="main-content">
        <Header 
          title="Flagged Submissions" 
          subtitle="Plagiarism detected among students"
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        
        <div className="page-body">
          {/* Controls */}
          <div style={{ marginBottom: '24px', display: 'flex', gap: '16px' }}>
            <div style={{ position: 'relative', width: '300px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
              <input
                type="text"
                placeholder="Search by roll number..."
                value={filterRoll}
                onChange={(e) => setFilterRoll(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px',
                  border: '1px solid var(--clr-border)', background: 'var(--clr-surface)',
                  color: 'var(--clr-text)', outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ background: 'var(--clr-surface)', borderRadius: '16px', border: '1px solid var(--clr-border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--clr-border)' }}>
                <tr>
                  <th style={{ padding: '16px 20px', color: 'var(--clr-text-2)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Flagged Roll</th>
                  <th style={{ padding: '16px 20px', color: 'var(--clr-text-2)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matched With</th>
                  <th style={{ padding: '16px 20px', color: 'var(--clr-text-2)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Question</th>
                  <th style={{ padding: '16px 20px', color: 'var(--clr-text-2)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Similarity</th>
                  <th style={{ padding: '16px 20px', color: 'var(--clr-text-2)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detected At</th>
                  <th style={{ padding: '16px 20px', color: 'var(--clr-text-2)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--clr-text-2)' }}>
                      Loading submissions...
                    </td>
                  </tr>
                ) : filteredFlags.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--clr-text-2)' }}>
                      No flagged submissions found.
                    </td>
                  </tr>
                ) : (
                  filteredFlags.map(flag => (
                    <tr key={flag.id} style={{ borderBottom: '1px solid var(--clr-border)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--clr-danger)' }}>{flag.flagged_student_roll}</td>
                      <td style={{ padding: '16px 20px', fontWeight: 600 }}>{flag.copied_from_student_roll}</td>
                      <td style={{ padding: '16px 20px', color: 'var(--clr-text-2)' }}>Q{flag.question_id}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '20px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 600, fontSize: '12px' }}>
                          {(flag.similarity_score * 100).toFixed(1)}% Match
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', color: 'var(--clr-text-2)' }}>{new Date(flag.detected_at).toLocaleString()}</td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedFlag(flag)}
                        >
                          View Code
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Code Viewer Modal */}
      {selectedFlag && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: 'var(--clr-bg)', borderRadius: '20px', width: '100%', maxWidth: '1200px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 50px rgba(0,0,0,0.6)', border: '1px solid var(--clr-border)'
          }}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--clr-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px' }}>Plagiarism Comparison (Q{selectedFlag.question_id})</h2>
                <div style={{ marginTop: '8px', color: 'var(--clr-danger)', fontWeight: 600 }}>
                  Similarity: {(selectedFlag.similarity_score * 100).toFixed(1)}%
                </div>
              </div>
              <button 
                onClick={() => setSelectedFlag(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--clr-text-2)', fontSize: '24px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <div style={{ flex: 1, borderRight: '1px solid var(--clr-border)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '12px 24px', background: 'var(--clr-surface)', borderBottom: '1px solid var(--clr-border)', fontWeight: 600 }}>
                  Flagged Student: <span style={{ color: 'var(--clr-danger)' }}>{selectedFlag.flagged_student_roll}</span>
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: '24px', background: '#1e1e1e' }}>
                  <pre style={{ margin: 0, color: '#d4d4d4', fontFamily: 'monospace', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                    {selectedFlag.flagged_code || "Code not available."}
                  </pre>
                </div>
              </div>
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '12px 24px', background: 'var(--clr-surface)', borderBottom: '1px solid var(--clr-border)', fontWeight: 600 }}>
                  Matched Source: <span style={{ color: 'var(--clr-primary)' }}>{selectedFlag.copied_from_student_roll}</span>
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: '24px', background: '#1e1e1e' }}>
                  <pre style={{ margin: 0, color: '#d4d4d4', fontFamily: 'monospace', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                    {selectedFlag.copied_from_code || "Code not available."}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlaggedSubmissions;
