import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginStart, loginSuccess, loginFailure } from '../store/authSlice';
import { authApi } from '../api/api';

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((s) => s.auth);

  const [form, setForm] = useState({ username: '', password: '' });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(loginStart());
    try {
      const { data } = await authApi.login(form);
      dispatch(loginSuccess({ ...data, ...data.tokens }));
      const role = data.user?.role;
      navigate(role === 'teacher' ? '/teacher' : '/student');
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'Login failed. Check credentials.';
      dispatch(loginFailure(msg));
    }
  };

  return (
    <div className="auth-root">
      {/* Background glows */}
      <div className="auth-bg-blur" style={{ width:500, height:500, background:'#6366f1', top:-200, left:-200 }} />
      <div className="auth-bg-blur" style={{ width:400, height:400, background:'#8b5cf6', bottom:-150, right:-150 }} />

      <div className="auth-card">
        <div className="auth-logo-ring">💻</div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in to CodeLab Assignment System</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              id="username" name="username" type="text"
              className="form-input" placeholder="Enter your username"
              value={form.username} onChange={handleChange} required autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="password" name="password" type="password"
              className="form-input" placeholder="Enter your password"
              value={form.password} onChange={handleChange} required
            />
          </div>

          <button type="submit" id="btn-login" className="btn btn-primary w-full btn-lg" style={{marginTop:8}} disabled={loading}>
            {loading ? <><span className="spinner" /> Signing in...</> : '→ Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register" style={{color:'var(--clr-accent-light)', fontWeight:600}}>Create account</Link>
        </div>
      </div>
    </div>
  );
}
