import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import Modal from '../../components/common/Modal';
import { addStudent, addTeacher } from '../../services/userService';
import styles from './AddUser.module.css';

const AddUser = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userType, setUserType] = useState('student'); // 'student' | 'teacher'
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [credModal, setCredModal] = useState(null); // { username, password }

  // Student form
  const [rollNumber, setRollNumber] = useState('');

  // Teacher form
  const [teacherUsername, setTeacherUsername] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!rollNumber.trim()) { addToast('Roll number is required.', 'warning'); return; }
    setLoading(true);
    try {
      const res = await addStudent(rollNumber.trim());
      setCredModal({ username: res.username || rollNumber, password: res.password || rollNumber });
      setRollNumber('');
      addToast('Student added successfully!', 'success');
    } catch (err) {
      addToast(err?.response?.data?.message || 'Failed to add student.', 'error');
    } finally { setLoading(false); }
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
          <div className={styles.roleSelector}>
            <div
              className={`${styles.roleCard} ${userType === 'student' ? styles.selected : ''}`}
              onClick={() => setUserType('student')}
              role="button" tabIndex={0}
            >
              <div className={styles.roleIcon}>🎓</div>
              <div className={styles.roleLabel}>Add Student</div>
              <div className={styles.roleDesc}>Provide roll number to create student account</div>
            </div>
            <div
              className={`${styles.roleCard} ${userType === 'teacher' ? styles.selected : ''}`}
              onClick={() => setUserType('teacher')}
              role="button" tabIndex={0}
            >
              <div className={styles.roleIcon}>👨‍🏫</div>
              <div className={styles.roleLabel}>Add Teacher</div>
              <div className={styles.roleDesc}>Provide username and password for teacher account</div>
            </div>
          </div>

          {/* Student form */}
          {userType === 'student' && (
            <div className={`card ${styles.formCard}`}>
              <h3 style={{ fontWeight: 700, marginBottom: 20 }}>Add New Student</h3>
              <form onSubmit={handleAddStudent}>
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
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: 160, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Adding…</> : '+ Add Student'}
                </button>
              </form>
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
