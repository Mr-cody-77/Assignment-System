import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import Loader from '../../components/Loader/Loader';
import StatCard from '../../components/common/StatCard';
import { getTestById, deleteTest, deleteQuestion } from '../../services/testService';
import { formatDate } from '../../utils/formatters';
import EditQuestionModal from './EditQuestionModal';
import EditTestModal from './EditTestModal';
import AddQuestionModal from './AddQuestionModal';

const TeacherTestDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editingTest, setEditingTest] = useState(false);
  const [addingQuestion, setAddingQuestion] = useState(false);

  const fetchTest = async () => {
    setLoading(true);
    try {
      const testRes = await getTestById(id);
      setTest(testRes);
    } catch (err) {
      setError('Failed to load test.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTest();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this test?")) return;
    setDeleting(true);
    try {
      await deleteTest(id);
      navigate('/teacher/tests');
    } catch(err) {
      console.error(err);
      setError('Failed to delete test.');
      setDeleting(false);
    }
  }

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm("Are you sure you want to delete this question?")) return;
    try {
      await deleteQuestion(questionId);
      fetchTest();
    } catch(err) {
      console.error(err);
      alert('Failed to delete question.');
    }
  }

  if (loading) return <Loader fullPage text="Loading test..." />;

  if (error || !test) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <p style={{ color: 'var(--clr-error)' }}>{error || 'Test not found.'}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/teacher/tests')}>
          Back to Tests
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar role="teacher" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title={test.name}
          subtitle={`Test #${test.id} | Created ${formatDate(test.created_at)}`}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary btn-sm" onClick={() => navigate(`/teacher/tests/${id}/permissions`)}>
                Change Test permission
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => setEditingTest(true)}>
                Edit Test
                </button>
                <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/teacher/tests')}>
                Back
                </button>
            </div>
          }
        />

        <div className="page-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            <StatCard label="Questions" value={test.questions?.length || 0} icon="📝" color="#6366f1" />
            <StatCard label="Duration (min)" value={test.duration_minutes} icon="⏱️" color="#10b981" />
            <StatCard label="Status" value={test.is_live ? "Live" : "Draft"} icon="🔵" color="#f59e0b" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>
              Questions in this Test
            </h2>
            <button className="btn btn-primary btn-sm" onClick={() => setAddingQuestion(true)}>
              + Add Question
            </button>
          </div>
          
          {test.questions?.length === 0 ? (
             <p style={{ color: 'var(--clr-text-3)', fontSize: 14 }}>No questions found in this test.</p>
          ) : (
            test.questions?.map((q, idx) => (
                <div key={q.id || idx} className="card" style={{ marginBottom: 20, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                            {idx + 1}. {q.title} 
                            <span style={{fontSize: 12, fontWeight: 'normal', color: 'var(--clr-text-2)', marginLeft: 8}}>
                                (Marks: {q.marks || 10})
                            </span>
                        </h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                                className="btn btn-secondary btn-sm" 
                                onClick={() => setEditingQuestion(q)}
                            >
                                ✏️ Edit
                            </button>
                            <button 
                                className="btn btn-danger btn-sm" 
                                onClick={() => handleDeleteQuestion(q.id)}
                            >
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap', color: 'var(--clr-text-2)' }}>
                        {q.description}
                    </p>
                    
                    <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
                        <span style={{ fontSize: 13, color: 'var(--clr-text-2)' }}>Visible Test Cases: {q.test_cases?.length || 0}</span>
                        <span style={{ fontSize: 13, color: 'var(--clr-text-2)' }}>Hidden Test Cases: {q.hidden_test_cases?.length || 0}</span>
                    </div>
                </div>
            ))
          )}
        </div>
      </div>
      {editingQuestion && (
        <EditQuestionModal
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onUpdate={fetchTest}
        />
      )}
      {editingTest && (
        <EditTestModal
          test={test}
          onClose={() => setEditingTest(false)}
          onUpdate={fetchTest}
        />
      )}
      {addingQuestion && (
        <AddQuestionModal
          testId={test.id}
          onClose={() => setAddingQuestion(false)}
          onUpdate={fetchTest}
        />
      )}
    </div>
  );
};

export default TeacherTestDetails;
