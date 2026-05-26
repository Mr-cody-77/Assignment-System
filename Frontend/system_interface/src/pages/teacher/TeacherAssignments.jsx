import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import EmptyState from '../../components/common/EmptyState';
import { SkeletonCard } from '../../components/Loader/SkeletonLoader';
import SearchBar from '../../components/SearchBar/SearchBar';
import { getAllAssignments } from '../../services/assignmentService';
import { getResults } from '../../services/resultService';
import { filterData } from '../../utils/helpers';
import { formatDate } from '../../utils/formatters';

const TeacherAssignments = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [results, setResults] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [assignmentRes, resultRes] = await Promise.allSettled([
        getAllAssignments(),
        getResults(),
      ]);

      setAssignments(
        assignmentRes.status === 'fulfilled' && Array.isArray(assignmentRes.value)
          ? assignmentRes.value
          : []
      );
      setResults(
        resultRes.status === 'fulfilled' && Array.isArray(resultRes.value)
          ? resultRes.value
          : []
      );
      setLoading(false);
    };

    fetchData();
  }, []);

  const submissionCounts = useMemo(() => {
    return results.reduce((acc, result) => {
      const key = String(result.question_id);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [results]);

  const filtered = filterData(assignments, search, ['title', 'description', 'id']);
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );

  return (
    <div className="app-shell">
      <Sidebar role="teacher" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Assignments"
          subtitle={`${assignments.length} assignment${assignments.length !== 1 ? 's' : ''}`}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          actions={
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/teacher/add-assignment')}
            >
              Add Assignment
            </button>
          }
        />

        <div className="page-body">
          <div style={{ marginBottom: 20, maxWidth: 420 }}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search assignments..."
            />
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map((item) => <SkeletonCard key={item} />)}
            </div>
          ) : sorted.length === 0 ? (
            <EmptyState
              icon="AS"
              title={search ? 'No matching assignments' : 'No assignments yet'}
              description={search ? 'Try another search term.' : 'Create an assignment to see it here.'}
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Assignment Title</th>
                    <th>Problem ID</th>
                    <th>Created</th>
                    <th>Submissions</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((assignment) => {
                    const id = String(assignment.id);
                    const visibleCount = assignment.test_cases?.length || 0;
                    const hiddenCount = assignment.hidden_test_cases?.length || 0;
                    const isReady = visibleCount + hiddenCount > 0;

                    return (
                      <tr
                        key={assignment.id}
                        onClick={() => navigate(`/teacher/assignments/${assignment.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ fontWeight: 700 }}>{assignment.title}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>#{assignment.id}</td>
                        <td style={{ fontSize: 12, color: 'var(--clr-text-2)' }}>
                          {formatDate(assignment.created_at)}
                        </td>
                        <td>{submissionCounts[id] || 0}</td>
                        <td>
                          <span className={`badge ${isReady ? 'badge-success' : 'badge-warning'}`}>
                            {isReady ? 'Ready' : 'Needs Tests'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/teacher/assignments/${assignment.id}`);
                            }}
                          >
                            View
                          </button>
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

export default TeacherAssignments;
