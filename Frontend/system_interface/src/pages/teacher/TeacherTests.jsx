import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import EmptyState from '../../components/common/EmptyState';
import { SkeletonCard } from '../../components/Loader/SkeletonLoader';
import SearchBar from '../../components/SearchBar/SearchBar';
import { getAllTests, toggleTestLive } from '../../services/testService';
import { filterData } from '../../utils/helpers';
import { formatDate } from '../../utils/formatters';

const TeacherTests = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tests, setTests] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTests = async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    try {
      const testsRes = await getAllTests();
      if (Array.isArray(testsRes)) {
        setTests(testsRes);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTests(true);
  }, []);

  const handleToggleLive = async (e, id) => {
    e.stopPropagation();
    try {
      await toggleTestLive(id);
      await fetchTests(false); // no skeleton flash on toggle
    } catch (err) {
      console.error("Failed to toggle test live status", err);
    }
  };

  const filtered = filterData(tests, search, ['name', 'id']);
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );

  return (
    <div className="app-shell">
      <Sidebar role="teacher" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Tests"
          subtitle={`${tests.length} test${tests.length !== 1 ? 's' : ''}`}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          actions={
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/teacher/create-test')}
            >
              Create Test
            </button>
          }
        />

        <div className="page-body">
          <div style={{ marginBottom: 20, maxWidth: 420 }}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search tests..."
            />
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map((item) => <SkeletonCard key={item} />)}
            </div>
          ) : sorted.length === 0 ? (
            <EmptyState
              icon="AS"
              title={search ? 'No matching tests' : 'No tests yet'}
              description={search ? 'Try another search term.' : 'Create a test to see it here.'}
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th>Test ID</th>
                    <th>Created</th>
                    <th>Duration (min)</th>
                    <th>Questions</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((test) => {
                    return (
                      <tr
                        key={test.id}
                        onClick={() => navigate(`/teacher/tests/${test.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ fontWeight: 700 }}>{test.name}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>#{test.id}</td>
                        <td style={{ fontSize: 12, color: 'var(--clr-text-2)' }}>
                          {formatDate(test.created_at)}
                        </td>
                        <td>{test.duration_minutes}</td>
                        <td>{test.questions?.length || 0}</td>
                        <td>
                          <span className={`badge ${test.is_live ? 'badge-success' : 'badge-warning'}`}>
                            {test.is_live ? 'Live' : 'Draft'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/teacher/tests/${test.id}`);
                              }}
                            >
                              View
                            </button>
                            <button
                              className={`btn btn-sm ${test.is_live ? 'btn-danger' : 'btn-primary'}`}
                              onClick={(e) => handleToggleLive(e, test.id)}
                            >
                              {test.is_live ? 'Stop Live' : 'Set Live'}
                            </button>
                          </div>
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
};

export default TeacherTests;
