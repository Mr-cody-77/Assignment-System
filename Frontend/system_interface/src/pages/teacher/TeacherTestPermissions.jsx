import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import runtimeConfig from '../../config/runtimeConfig';

const TeacherTestPermissions = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rollNumbers, setRollNumbers] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const formData = new FormData();
      if (rollNumbers) {
        formData.append('roll_numbers', rollNumbers);
      }
      if (file) {
        formData.append('file', file);
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`${runtimeConfig.getCentralURL()}/api/questions/tests/${id}/grant_reattempt/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || 'Permissions updated successfully.');
        setRollNumbers('');
        setFile(null);
      } else {
        setError(data.error || 'Failed to update permissions.');
      }
    } catch (err) {
      setError('Network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar role="teacher" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Change Test Permissions"
          subtitle={`Test #${id}`}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          actions={
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/teacher/tests/${id}`)}>
              Back to Test
            </button>
          }
        />
        <div className="page-body">
          <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              Grant Re-attempt Access
            </h2>
            <p style={{ color: 'var(--clr-text-2)', marginBottom: '24px', fontSize: '14px' }}>
              Allow students to re-take this test. You can manually enter their roll numbers, or upload an Excel file containing a list of roll numbers in the first column. Their previous submissions will be kept for records.
            </p>

            {message && <div style={{ color: 'var(--clr-success)', marginBottom: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '4px' }}>{message}</div>}
            {error && <div style={{ color: 'var(--clr-error)', marginBottom: '16px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>{error}</div>}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Roll Numbers (comma separated)
                </label>
                <textarea
                  className="form-input"
                  rows="4"
                  value={rollNumbers}
                  onChange={(e) => setRollNumbers(e.target.value)}
                  placeholder="e.g. 23MM8001, 23CS1001"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--clr-text-3)' }}>OR</div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Upload Excel File
                </label>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => setFile(e.target.files[0])}
                  style={{ width: '100%' }}
                />
                <small style={{ color: 'var(--clr-text-3)', display: 'block', marginTop: '4px' }}>
                  Ensure roll numbers are in the first column.
                </small>
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '16px' }}>
                {loading ? 'Processing...' : 'Grant Access'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherTestPermissions;
