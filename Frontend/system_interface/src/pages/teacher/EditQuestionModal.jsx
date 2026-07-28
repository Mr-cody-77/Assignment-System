import React, { useState } from 'react';
import { useToast } from '../../hooks/useToast';
import { updateAssignment } from '../../services/assignmentService';
import { generateTestCases } from '../../services/testService';

const emptyTestCase = () => ({ input: '', output: '' });

const EditQuestionModal = ({ question, onClose, onUpdate }) => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState({
    title: question.title || '',
    description: question.description || '',
    constraints: question.constraints || '',
    marks: question.marks || 10,
    test_cases: question.test_cases?.length 
      ? question.test_cases.map(tc => ({ input: tc.input_data, output: tc.expected_output })) 
      : [emptyTestCase()],
    hidden_test_cases: question.hidden_test_cases?.length 
      ? question.hidden_test_cases.map(tc => ({ input: tc.input_data, output: tc.expected_output })) 
      : [emptyTestCase()],
  });

  const handleChange = (field, value) => {
    setQ((prev) => ({ ...prev, [field]: value }));
  };

  const handleTCChange = (type, index, field, value) => {
    setQ((prev) => {
      const updatedTcs = [...prev[type]];
      updatedTcs[index] = { ...updatedTcs[index], [field]: value };
      return { ...prev, [type]: updatedTcs };
    });
  };

  const addTC = (type) => {
    setQ((prev) => ({ ...prev, [type]: [...prev[type], emptyTestCase()] }));
  };

  const removeTC = (type, index) => {
    setQ((prev) => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index),
    }));
  };

  const handleAIGenerate = async () => {
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
        setQ((prev) => ({
          ...prev,
          test_cases: data.test_cases?.length ? data.test_cases.map(tc => ({ input: String(tc.input), output: String(tc.output) })) : prev.test_cases,
          hidden_test_cases: data.hidden_test_cases?.length ? data.hidden_test_cases.map(tc => ({ input: String(tc.input), output: String(tc.output) })) : prev.hidden_test_cases
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
    if (!q.title.trim() || !q.description.trim()) {
      addToast('Title and description are required.', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      const cleanedData = {
        title: q.title.trim(),
        description: q.description.trim(),
        constraints: q.constraints.trim(),
        marks: q.marks,
        test_cases: q.test_cases.filter(tc => tc.input.trim()),
        hidden_test_cases: q.hidden_test_cases.filter(tc => tc.input.trim()),
      };

      await updateAssignment(question.id, cleanedData);
      addToast('Question updated successfully!', 'success');
      onUpdate();
      onClose();
    } catch (err) {
      addToast('Failed to update question.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-box" 
        style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }} 
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>Edit Question</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Question Title *</label>
            <input
              type="text"
              className="form-input"
              value={q.title}
              onChange={(e) => handleChange('title', e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Problem Description *</label>
            <textarea
              className="form-textarea"
              value={q.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={4}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Constraints</label>
            <textarea
              className="form-textarea"
              value={q.constraints}
              onChange={(e) => handleChange('constraints', e.target.value)}
              placeholder="e.g. 1 <= N <= 10^5"
              rows={2}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleAIGenerate} disabled={loading}>
              ✨ Auto-Generate Testcases with AI
            </button>
          </div>
          
          <div className="form-group" style={{ maxWidth: '200px' }}>
            <label className="form-label">Marks</label>
            <input
              type="number"
              className="form-input"
              value={q.marks}
              onChange={(e) => handleChange('marks', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
            />
          </div>

          {/* Visible Test Cases */}
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>Visible Test Cases</h4>
            {q.test_cases.map((tc, tcIndex) => (
              <div key={tcIndex} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <textarea className="form-textarea" rows={2} placeholder="Input" value={tc.input}
                    onChange={(e) => handleTCChange('test_cases', tcIndex, 'input', e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <textarea className="form-textarea" rows={2} placeholder="Expected Output" value={tc.output}
                    onChange={(e) => handleTCChange('test_cases', tcIndex, 'output', e.target.value)} />
                </div>
                {q.test_cases.length > 1 && (
                  <button type="button" className="btn btn-danger btn-sm" style={{ marginTop: '4px' }}
                    onClick={() => removeTC('test_cases', tcIndex)}>✕</button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTC('test_cases')}>
              + Add Visible Test Case
            </button>
          </div>

          {/* Hidden Test Cases */}
          <div style={{ marginTop: '20px', marginBottom: '24px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>Hidden Test Cases</h4>
              <p style={{ margin: 0, color: '#aaa', fontSize: '14px' }}>
                {q.hidden_test_cases.length} hidden test case(s) currently attached. (Auto-generated or hidden from view)
              </p>
            </div>
            {q.hidden_test_cases.length > 0 && (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => handleChange('hidden_test_cases', [])}>
                Clear
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditQuestionModal;
