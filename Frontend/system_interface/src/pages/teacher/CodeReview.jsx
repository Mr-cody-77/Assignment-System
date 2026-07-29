import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import CodeEditor from '../../components/CodeEditor/CodeEditor';
import { getCodeHistory } from '../../services/resultService';
import { useToast } from '../../hooks/useToast';
import Loader from '../../components/Loader/Loader';
import styles from './CodeReview.module.css'; // Let's use simple inline styles or standard CSS for layout if module is missing, but I will provide standard structure.

const CodeReview = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rollNumber, setRollNumber] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const { addToast } = useToast();

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getCodeHistory(rollNumber);
      setHistory(data);
    } catch (err) {
      addToast(err?.response?.data?.error || 'Failed to fetch code history.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchHistory();
  };

  return (
    <div className="app-shell">
      <Sidebar role="teacher" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Header
          title="Code Review"
          subtitle="Review student code submissions"
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <div style={{ padding: '20px', display: 'flex', gap: '20px', flex: 1, overflow: 'hidden' }}>
          {/* Left panel: Filters and List */}
          <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--clr-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--clr-border)' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--clr-text)', marginBottom: '6px' }}>
                  Search by Roll Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 23EC8027"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--clr-border)',
                    backgroundColor: 'var(--clr-background)',
                    color: 'var(--clr-text)',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--clr-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--clr-border)'}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '10px', borderRadius: '8px', fontWeight: '600' }}>
                Search
              </button>
            </form>

            <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--clr-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', color: 'var(--clr-text-3)' }}>Loading...</div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--clr-text-3)', fontSize: '14px' }}>No submissions found.</div>
              ) : (
                history.map((sub) => (
                  <div
                    key={sub.id}
                    onClick={() => setSelectedSubmission(sub)}
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      background: selectedSubmission?.id === sub.id ? 'var(--clr-background)' : 'transparent',
                      border: '1px solid var(--clr-border)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--clr-text)' }}>{sub.roll_number}</div>
                    <div style={{ fontSize: '12px', color: 'var(--clr-text-2)' }}>QID: {sub.question_id}</div>
                    <div style={{ fontSize: '11px', color: 'var(--clr-text-3)', marginTop: '4px' }}>
                      {new Date(sub.submitted_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right panel: Code Editor View */}
          <div style={{ flex: 1, background: 'var(--clr-surface)', borderRadius: '8px', border: '1px solid var(--clr-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {selectedSubmission ? (
              <>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--clr-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: 'var(--clr-text)' }}>{selectedSubmission.roll_number}</div>
                    <div style={{ fontSize: '12px', color: 'var(--clr-text-2)' }}>Language: {selectedSubmission.language || 'python'}</div>
                  </div>
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <CodeEditor
                    value={selectedSubmission.code || ''}
                    language={selectedSubmission.language || 'python'}
                    readOnly={true}
                    height="100%"
                  />
                  {/* Overlay to block interaction if CodeEditor doesn't support readOnly directly, but passing readOnly is usually standard. 
                      Let's check if CodeEditor handles readOnly. */}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--clr-text-3)' }}>
                Select a submission to view code
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeReview;
