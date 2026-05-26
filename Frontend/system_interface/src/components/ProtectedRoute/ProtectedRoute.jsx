import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Loader from '../Loader/Loader';

/**
 * ProtectedRoute — guards a route by authentication and optional role.
 *
 * @param {React.ReactNode} children      — page component to render
 * @param {string|null}     requiredRole  — 'teacher' | 'student' | null (any authenticated)
 */
const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <Loader fullPage text="Loading session…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    // Teacher trying student route or vice versa → redirect to their dashboard
    return <Navigate to={user?.role === 'teacher' ? '/teacher' : '/student'} replace />;
  }

  return children;
};

export default ProtectedRoute;
