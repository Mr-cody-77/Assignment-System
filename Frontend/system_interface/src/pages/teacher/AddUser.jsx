import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import Modal from '../../components/common/Modal';
import { addStudent, addTeacher, bulkUploadStudents } from '../../services/userService';
import { centralRequest } from '../../services/api';
import { endpoints } from '../../config/endpointResolver';
import styles from './AddUser.module.css';

const AddUser = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userType, setUserType] = useState('student'); // 'student' | 'teacher' | 'bulk'
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [credModal, setCredModal] = useState(null); // { username, password }

  // Student form
  const [rollNumber, setRollNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [department, setDepartment] = useState('');

  // Bulk Upload
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  // Teacher form
  const [teacherUsername, setTeacherUsername] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!rollNumber.trim()) { addToast('Roll number is required.', 'warning'); return; }
    setLoading(true);
    try {
      const res = await centralRequest.post(endpoints.addStudent(), { 
        roll_number: rollNumber.trim(),
        name: studentName.trim(),
        department: department.trim() || 'N/A'
      });
      setCredModal({ username: res.data.username || rollNumber, password: res.data.password || rollNumber });
      setRollNumber('');
      setStudentName('');
      setDepartment('');
      addToast('Student added successfully!', 'success');
    } catch (err) {
      addToast(err?.response?.data?.message || 'Failed to add student.', 'error');
    } finally { setLoading(false); }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      addToast('Please select a file to upload.', 'warning');
      return;
    }
    setLoading(true);
    setUploadResult(null);
    try {
      const res = await bulkUploadStudents(selectedFile);
      setUploadResult(res);
      addToast('Bulk upload completed successfully!', 'success');
      setSelectedFile(null);
    } catch (err) {
      addToast(err?.response?.data?.error || 'Failed to upload students.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!teacherUsername.trim() || !teacherPassword.trim()) {
      addToast('Username and password are required.', 'warning'); return;
    }
    setLoading(true);
    try {
      await addTeacher(teacherUsername.trim(), teacherPassword);
      addToast(`Teacher "${teacherUsername}" added successfully!`, 'success');
      setTeacherUsername(''); setTeacherPassword('');
    } catch (err) {
      addToast(err?.response?.data?.message || 'Failed to add teacher.', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="app-shell">
      <Sidebar role="teacher" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title="Add User"
          subtitle="Add students or teachers to the system"
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <div className="page-body">
          {/* Role selector */}
          <div className={styles.roleSelector} style={{ gridTemplateColumns: '1fr 1fr 1fr', maxWidth: 800 }}>
            <div
              className={`${styles.roleCard} ${userType === 'student' ? styles.selected : ''}`}
              onClick={() => setUserType('student')}
              role="button" tabIndex={0}
            >
              <div className={styles.roleIcon}>🎓</div>
              <div className={styles.roleLabel}>Add Student</div>
              <div className={styles.roleDesc}>Create a single student account</div>
            </div>
            <div
              className={`${styles.roleCard} ${userType === 'bulk' ? styles.selected : ''}`}
              onClick={() => setUserType('bulk')}
              role="button" tabIndex={0}
            >
              <div className={styles.roleIcon}>📁</div>
              <div className={styles.roleLabel}>Bulk Upload</div>
              <div className={styles.roleDesc}>Upload multiple students via Excel/CSV</div>
            </div>
            <div
              className={`${styles.roleCard} ${userType === 'teacher' ? styles.selected : ''}`}
              onClick={() => setUserType('teacher')}
              role="button" tabIndex={0}
            >
              <div className={styles.roleIcon}>👨‍🏫</div>
              <div className={styles.roleLabel}>Add Teacher</div>
              <div className={styles.roleDesc}>Create a teacher account</div>
            </div>
          </div>

          {/* Student form */}
          {userType === 'student' && (
            <div className={`card ${styles.formCard}`}>
              <h3 style={{ fontWeight: 700, marginBottom: 20 }}>Add New Student</h3>
              <form onSubmit={handleAddStudent}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Roll Number *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="e.g. CS2024001"
                    required
                  />
                  <p style={{ fontSize: 12, color: 'var(--clr-text-3)', marginTop: 6 }}>
                    The student's username and initial password will both be set to the roll number.
                  </p>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input
                    type="text"
                    className="form-input"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Computer Science"
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: 160, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Adding…</> : '+ Add Student'}
                </button>
              </form>
            </div>
          )}

          {/* Bulk Upload form */}
          {userType === 'bulk' && (
            <div className={`card ${styles.formCard}`} style={{ maxWidth: 600 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 20 }}>Bulk Upload Students</h3>
              
              <div style={{ marginBottom: 24, fontSize: 14, color: 'var(--clr-text-2)' }}>
                <p>Upload an Excel (.xlsx, .xls) or CSV file containing student records.</p>
                <p style={{ marginTop: 8 }}>Required columns: <strong>Name</strong>, <strong>Roll</strong> (or Roll Number)</p>
                <p>Optional column: <strong>Department</strong></p>
              </div>

              <form onSubmit={handleBulkUpload}>
                <div className={styles.fileUploadArea}>
                  <input 
                    type="file" 
                    id="file-upload" 
                    accept=".xlsx,.xls,.csv" 
                    onChange={handleFileChange}
                    className={styles.fileInput}
                  />
                  <label htmlFor="file-upload" className={styles.fileLabel}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📁</div>
                    {selectedFile ? (
                      <span style={{ fontWeight: 600, color: 'var(--clr-primary)' }}>{selectedFile.name}</span>
                    ) : (
                      <span>Click to select an Excel or CSV file</span>
                    )}
                  </label>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={loading || !selectedFile} 
                  style={{ minWidth: 160, display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}
                >
                  {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Uploading…</> : '⬆ Upload File'}
                </button>
              </form>

              {uploadResult && (
                <div className={styles.uploadResultBox}>
                  <h4 style={{ marginBottom: 12 }}>Upload Summary</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div className={styles.statBox}>
                      <span style={{ fontSize: 24, color: 'var(--clr-success)' }}>{uploadResult.created}</span>
                      <span style={{ fontSize: 12 }}>Created</span>
                    </div>
                    <div className={styles.statBox}>
                      <span style={{ fontSize: 24, color: 'var(--clr-warning)' }}>{uploadResult.skipped}</span>
                      <span style={{ fontSize: 12 }}>Skipped (Existing)</span>
                    </div>
                  </div>
                  
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className={styles.errorsList}>
                      <h5 style={{ color: 'var(--clr-danger)', marginBottom: 8 }}>Errors ({uploadResult.errors.length})</h5>
                      <ul style={{ paddingLeft: 20, fontSize: 13 }}>
                        {uploadResult.errors.slice(0, 10).map((err, i) => (
                          <li key={i}>Roll <strong>{err.roll || 'Unknown'}</strong>: {err.reason}</li>
                        ))}
                        {uploadResult.errors.length > 10 && (
                          <li>...and {uploadResult.errors.length - 10} more errors.</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Teacher form */}
          {userType === 'teacher' && (
            <div className={`card ${styles.formCard}`}>
              <h3 style={{ fontWeight: 700, marginBottom: 20 }}>Add New Teacher</h3>
              <form onSubmit={handleAddTeacher}>
                <div className="form-group">
                  <label className="form-label">Username *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={teacherUsername}
                    onChange={(e) => setTeacherUsername(e.target.value)}
                    placeholder="e.g. prof_smith"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      value={teacherPassword}
                      onChange={(e) => setTeacherPassword(e.target.value)}
                      placeholder="Create a strong password"
                      required
                      style={{ paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--clr-text-3)' }}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: 160, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Adding…</> : '+ Add Teacher'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Credentials Modal (shown after student creation) */}
      <Modal
        isOpen={!!credModal}
        onClose={() => setCredModal(null)}
        title="🎉 Student Account Created"
        size="sm"
      >
        <p style={{ color: 'var(--clr-text-2)', marginBottom: 16 }}>
          Share these credentials with the student:
        </p>
        <div className={styles.credentialsBox}>
          <div><span>Username:</span> <strong>{credModal?.username}</strong></div>
          <div><span>Password:</span> <strong>{credModal?.password}</strong></div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--clr-text-3)', marginTop: 12 }}>
          The student should change their password after first login.
        </p>
        <button className="btn btn-primary" onClick={() => setCredModal(null)} style={{ marginTop: 16, width: '100%' }}>
          Done
        </button>
      </Modal>
    </div>
  );
};

export default AddUser;
