import React, { useState } from 'react';
import { updateTest } from '../../services/testService';

const EditTestModal = ({ test, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: test.name || '',
    duration_minutes: test.duration_minutes || 60,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData(prev => ({
        ...prev,
        [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
        const payload = {
            name: formData.name,
            duration_minutes: parseInt(formData.duration_minutes, 10),
        };
        await updateTest(test.id, payload);
        onUpdate();
        onClose();
    } catch (err) {
        console.error(err);
        setError('Failed to update test details.');
    } finally {
        setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Edit Test Details</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        
        {error && <div className="alert-error" style={{marginBottom: 16}}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Test Name</label>
            <input 
                type="text" 
                className="input-field" 
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
            />
          </div>
          
          <div className="form-group">
            <label>Duration (minutes)</label>
            <input 
                type="number" 
                className="input-field" 
                name="duration_minutes"
                value={formData.duration_minutes}
                onChange={handleChange}
                min="1"
                required
            />
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTestModal;
