import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import Loader from '../../components/Loader/Loader';
import ResultTable from '../../components/ResultTable/ResultTable';
import StatCard from '../../components/common/StatCard';
import { getAssignmentById } from '../../services/assignmentService';
import { getResults } from '../../services/resultService';
import { averageScorePercent, formatDate, formatScore } from '../../utils/formatters';

const TeacherAssignmentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assignment, setAssignment] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [assignmentRes, resultRes] = await Promise.allSettled([
        getAssignmentById(id),
        getResults(),
      ]);

      if (assignmentRes.status === 'fulfilled') {
        setAssignment(assignmentRes.value);
      } else {
        setError('Failed to load assignment.');
      }

      if (resultRes.status === 'fulfilled' && Array.isArray(resultRes.value)) {
        setResults(resultRes.value);
      }

      setLoading(false);
    };

    fetchData();
  }, [id]);

  const assignmentResults = useMemo(
    () => results.filter((result) => String(result.question_id) === String(id)),
    [results, id]
  );

  const acceptedCount = assignmentResults.filter((result) =>
    ['accepted', 'completed'].includes(result.status?.toLowerCase())
  ).length;
  const averageScore = averageScorePercent(assignmentResults);

  if (loading) return <Loader fullPage text="Loading assignment..." />;

  if (error || !assignment) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <p style={{ color: 'var(--clr-error)' }}>{error || 'Assignment not found.'}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/teacher/assignments')}>
          Back to Assignments
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar role="teacher" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title={assignment.title}
          subtitle={`Problem #${assignment.id} | Created ${formatDate(assignment.created_at)}`}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          actions={
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/teacher/assignments')}>
              Back
            </button>
          }
        />

        <div className="page-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            <StatCard label="Submissions" value={assignmentResults.length} icon="SB" color="#6366f1" />
            <StatCard label="Accepted" value={acceptedCount} icon="OK" color="#10b981" />
            <StatCard label="Average Score" value={formatScore(averageScore)} icon="SC" color="#f59e0b" />
            <StatCard
              label="Test Cases"
              value={`${assignment.test_cases?.length || 0}/${assignment.hidden_test_cases?.length || 0}`}
              icon="TC"
              color="#06b6d4"
            />
          </div>

          <div className="card" style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Problem</h2>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--clr-text-2)', lineHeight: 1.7 }}>
              {assignment.description}
            </pre>
            {assignment.input_format && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
                  Input Format
                </h3>
                <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--clr-text-2)', lineHeight: 1.7 }}>
                  {assignment.input_format}
                </pre>
              </>
            )}
            {assignment.output_format && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
                  Output Format
                </h3>
                <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--clr-text-2)', lineHeight: 1.7 }}>
                  {assignment.output_format}
                </pre>
              </>
            )}
            {assignment.constraints && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
                  Constraints
                </h3>
                <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--clr-text-2)' }}>
                  {assignment.constraints}
                </pre>
              </>
            )}
          </div>

          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            Submissions
          </h2>
          <ResultTable results={assignmentResults} loading={false} showStudent />
        </div>
      </div>
    </div>
  );
};

export default TeacherAssignmentDetails;
