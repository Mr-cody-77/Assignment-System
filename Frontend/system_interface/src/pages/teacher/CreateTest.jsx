import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import { createTest, generateTestCases } from '../../services/testService';
// import styles from './CreateTest.module.css';

const emptyTestCase = () => ({ input: '', output: '' });
const emptyQuestion = () => ({
  title: '',
  description: '',
  constraints: '',
  marks: 10,
  test_cases: [emptyTestCase()],
  hidden_test_cases: [emptyTestCase()]
});

const CreateTest = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [testName, setTestName] = useState('');
  const [duration, setDuration] = useState(60);
  const [adminPassword, setAdminPassword] = useState('');
  const [questions, setQuestions] = useState([emptyQuestion()]);

  // Question helpers
  const updateQuestion = (qIndex, key, val) => {
    setQuestions((prev) => prev.map((q, idx) => (idx === qIndex ? { ...q, [key]: val } : q)));
  };
  const addQuestion = () => setQuestions((prev) => [...prev, emptyQuestion()]);
  const removeQuestion = (qIndex) => setQuestions((prev) => prev.filter((_, idx) => idx !== qIndex));

  // TestCase helpers
  const updateTC = (qIndex, tcType, tcIndex, key, val) => {
    setQuestions((prev) => prev.map((q, idx) => {
      if (idx !== qIndex) return q;
      const updatedTcs = q[tcType].map((tc, tIdx) => (tIdx === tcIndex ? { ...tc, [key]: val } : tc));
      return { ...q, [tcType]: updatedTcs };
    }));
  };
  const addTC = (qIndex, tcType) => {
    setQuestions((prev) => prev.map((q, idx) => {
      if (idx !== qIndex) return q;
      return { ...q, [tcType]: [...q[tcType], emptyTestCase()] };
    }));
  };
  const removeTC = (qIndex, tcType, tcIndex) => {
    setQuestions((prev) => prev.map((q, idx) => {
      if (idx !== qIndex) return q;
      return { ...q, [tcType]: q[tcType].filter((_, tIdx) => tIdx !== tcIndex) };
    }));
  };

  const handleAIGenerate = async (qIndex) => {
    const q = questions[qIndex];
    if (!q.title || !q.description) {
      addToast('Please enter Title and Description first.', 'warning');
      return;
    }
    
    setLoading(true);
    addToast('Generating test cases with AI...', 'info');

    try {
      const data = await generateTestCases({
        title: q.title,
        description: q.description,
        constraints: q.constraints || 'None provided'
      });

      if (data.test_cases || data.hidden_test_cases) {
        setQuestions((prev) => prev.map((item, idx) => {
          if (idx !== qIndex) return item;
          return {
            ...item,
            test_cases: data.test_cases?.length ? data.test_cases.map(tc => ({ input: String(tc.input), output: String(tc.output) })) : item.test_cases,
            hidden_test_cases: data.hidden_test_cases?.length ? data.hidden_test_cases.map(tc => ({ input: String(tc.input), output: String(tc.output) })) : item.hidden_test_cases
          };
        }));
        addToast('Test cases generated successfully!', 'success');
      } else {
        throw new Error('Invalid format from API');
      }
    } catch (err) {
      console.error(err);
      addToast(err?.response?.data?.error || 'Failed to generate test cases.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!testName.trim() || !adminPassword.trim()) {
      addToast('Test name and admin password are required.', 'warning');
      return;
    }
    setLoading(true);
    try {
      // Clean up questions
      const cleanedQuestions = questions.map(q => ({
        ...q,
        test_cases: q.test_cases.filter(tc => tc.input.trim()),
        hidden_test_cases: q.hidden_test_cases.filter(tc => tc.input.trim()),
        constraints: q.constraints?.trim() || '',
      }));

      await createTest({
        name: testName.trim(),
        duration_minutes: duration,
        admin_password: adminPassword,
        questions: cleanedQuestions,
      });
      addToast('Test created successfully!', 'success');
      // Reset
      setTestName(''); setDuration(60); setAdminPassword('');
      setQuestions([emptyQuestion()]);
    } catch (err) {
      addToast(err?.response?.data?.message || 'Failed to create test.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar role="teacher" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Create Test"
          subtitle="Configure a new exam with multiple questions"
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <div className="page-body">
          <form onSubmit={handleSubmit}>
            {/* Test Configuration */}
            <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '16px', fontWeight: 'bold' }}>Test Settings</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Test Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="e.g. Midterm Exam"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (minutes) *</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max="300"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Admin Password (UAC) *</label>
                  <input
                    className="form-input"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Windows admin password"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Questions List */}
            {questions.map((q, qIndex) => (
              <div key={qIndex} className="card" style={{ padding: '24px', marginBottom: '24px', borderLeft: '4px solid var(--clr-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>Question {qIndex + 1}</h3>
                  {questions.length > 1 && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeQuestion(qIndex)}>
                      ✕ Remove Question
                    </button>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Question Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={q.title}
                    onChange={(e) => updateQuestion(qIndex, 'title', e.target.value)}
                    placeholder="e.g. Reverse a String"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Problem Description *</label>
                  <textarea
                    className="form-textarea"
                    value={q.description}
                    onChange={(e) => updateQuestion(qIndex, 'description', e.target.value)}
                    placeholder="Describe the problem clearly…"
                    rows={4}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Constraints</label>
                  <textarea
                    className="form-textarea"
                    value={q.constraints}
                    onChange={(e) => updateQuestion(qIndex, 'constraints', e.target.value)}
                    placeholder="e.g. 1 <= N <= 10^5"
                    rows={2}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleAIGenerate(qIndex)} disabled={loading}>
                    ✨ Auto-Generate Testcases with AI
                  </button>
                </div>
                
                <div className="form-group" style={{ maxWidth: '200px' }}>
                  <label className="form-label">Marks</label>
                  <input
                    type="number"
                    className="form-input"
                    value={q.marks}
                    onChange={(e) => updateQuestion(qIndex, 'marks', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                  />
                </div>

                {/* Visible Test Cases */}
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>Visible Test Cases</h4>
                  {q.test_cases.map((tc, tcIndex) => (
                    <div key={tcIndex} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <textarea className="form-textarea" rows={2} placeholder="Input" value={tc.input}
                          onChange={(e) => updateTC(qIndex, 'test_cases', tcIndex, 'input', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <textarea className="form-textarea" rows={2} placeholder="Expected Output" value={tc.output}
                          onChange={(e) => updateTC(qIndex, 'test_cases', tcIndex, 'output', e.target.value)} />
                      </div>
                      {q.test_cases.length > 1 && (
                        <button type="button" className="btn btn-danger btn-sm" style={{ marginTop: '4px' }}
                          onClick={() => removeTC(qIndex, 'test_cases', tcIndex)}>✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTC(qIndex, 'test_cases')}>
                    + Add Visible Test Case
                  </button>
                </div>

                {/* Hidden Test Cases */}
                <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>Hidden Test Cases</h4>
                    <p style={{ margin: 0, color: '#aaa', fontSize: '14px' }}>
                      {q.hidden_test_cases.length} hidden test case(s) currently attached. (Auto-generated or hidden from view)
                    </p>
                  </div>
                  {q.hidden_test_cases.length > 0 && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => updateQuestion(qIndex, 'hidden_test_cases', [])}>
                      Clear
                    </button>
                  )}
                </div>

              </div>
            ))}

            <button type="button" className="btn btn-secondary" style={{ width: '100%', padding: '16px', borderStyle: 'dashed', marginBottom: '24px' }} onClick={addQuestion}>
              + Add Another Question
            </button>

            {/* Submit */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading}
                style={{ minWidth: 180 }}
              >
                {loading ? (
                  <><span className="spinner" style={{ width: 16, height: 16 }} /> Creating…</>
                ) : '✓ Create Test'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateTest;
