import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../store/authSlice';
import { authApi } from '../api/api';

const ROLES = [
  { value: 'student', label: 'Student', icon: '🎓', desc: 'Solve assignments & submit code' },
  { value: 'teacher', label: 'Teacher', icon: '👨‍🏫', desc: 'Create assignments & monitor results' },
];

export default function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    username: '', email: '', first_name: '', last_name: '',
    password: '', password2: '', role: 'student',
    roll_number: '', department: '', batch: '',
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const setRole = (r) => setForm({ ...form, role: r });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.password2) { setError('Passwords do not match.'); return; }
    setLoading(true); setError(null);
    try {
      const { data } = await authApi.register(form);
      dispatch(loginSuccess({ ...data.tokens, user: data.user }));
      navigate(data.user.role === 'teacher' ? '/teacher' : '/student');
    } catch (err) {
      const d = err.response?.data;
      const msg = d ? Object.values(d).flat().join(' ') : 'Registration failed.';
      setError(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-root" style={{alignItems:'flex-start', paddingTop:40}}>
      <div className="auth-bg-blur" style={{width:500,height:500,background:'#6366f1',top:-200,left:-200}} />
      <div className="auth-bg-blur" style={{width:400,height:400,background:'#8b5cf6',bottom:-100,right:-100}} />

      <div className="auth-card" style={{maxWidth:520}}>
        <div className="auth-logo-ring">🚀</div>
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-sub">Join CodeLab — Decentralized Assignment System</p>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Role Selector */}
        <div className="form-group">
          <label className="form-label">I am a</label>
          <div className="role-selector">
            {ROLES.map(r => (
              <div
                key={r.value}
                className={`role-option${form.role === r.value ? ' selected' : ''}`}
                onClick={() => setRole(r.value)}
                id={`role-${r.value}`}
              >
                <div className="role-icon">{r.icon}</div>
                <div className="role-name">{r.label}</div>
                <div style={{fontSize:11,color:'var(--clr-text-3)',marginTop:4}}>{r.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input name="first_name" className="form-input" placeholder="John" value={form.first_name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input name="last_name" className="form-input" placeholder="Doe" value={form.last_name} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Username</label>
            <input id="reg-username" name="username" className="form-input" placeholder="johndoe123" value={form.username} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input name="email" type="email" className="form-input" placeholder="john@college.edu" value={form.email} onChange={handleChange} />
          </div>

          {form.role === 'student' && (
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Roll Number *</label>
                <input name="roll_number" className="form-input" placeholder="CS2024001" value={form.roll_number} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Batch</label>
                <input name="batch" className="form-input" placeholder="2024-28" value={form.batch} onChange={handleChange} />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Department</label>
            <input name="department" className="form-input" placeholder="Computer Science" value={form.department} onChange={handleChange} />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Password</label>
              <input id="reg-password" name="password" type="password" className="form-input" placeholder="Min 8 characters" value={form.password} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input name="password2" type="password" className="form-input" placeholder="Repeat password" value={form.password2} onChange={handleChange} required />
            </div>
          </div>

          <button id="btn-register" type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
            {loading ? <><span className="spinner" /> Creating account...</> : '🎉 Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login" style={{color:'var(--clr-accent-light)',fontWeight:600}}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
