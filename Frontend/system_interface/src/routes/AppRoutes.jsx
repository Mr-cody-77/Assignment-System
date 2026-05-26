import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';

// Public pages
import Landing from '../pages/Landing/Landing';
import Login from '../pages/Login/Login';
import NodeConnections from '../pages/NodeConnections/NodeConnections';

// Teacher pages
import TeacherDashboard from '../pages/teacher/TeacherDashboard.jsx';
import TeacherAssignments from '../pages/teacher/TeacherAssignments';
import TeacherAssignmentDetails from '../pages/teacher/TeacherAssignmentDetails';
import AddAssignment from '../pages/teacher/AddAssignment';
import StudentResults from '../pages/teacher/StudentResults';
import TeacherNodeConnections from '../pages/teacher/TeacherNodeConnections';
import AddUser from '../pages/teacher/AddUser';
import AnalyticsPage from '../pages/teacher/AnalyticsPage';

// Student pages
import StudentDashboard from '../pages/student/StudentDashboard.jsx';
import Assignments from '../pages/student/Assignments';
import AssignmentDetails from '../pages/student/AssignmentDetails';
import TaskStatus from '../pages/student/TaskStatus';
import Results from '../pages/student/Results';
import StudentNodeConnections from '../pages/student/StudentNodeConnections';

export default function AppRoutes() {
  return (
    <Routes>
      {/* ── Public ────────────────────────────────── */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/nodes" element={<NodeConnections />} />

      {/* ── Teacher ───────────────────────────────── */}
      <Route
        path="/teacher"
        element={
          <ProtectedRoute requiredRole="teacher">
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/assignments"
        element={
          <ProtectedRoute requiredRole="teacher">
            <TeacherAssignments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/assignments/:id"
        element={
          <ProtectedRoute requiredRole="teacher">
            <TeacherAssignmentDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/add-assignment"
        element={
          <ProtectedRoute requiredRole="teacher">
            <AddAssignment />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/results"
        element={
          <ProtectedRoute requiredRole="teacher">
            <StudentResults />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/analytics"
        element={
          <ProtectedRoute requiredRole="teacher">
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/nodes"
        element={
          <ProtectedRoute requiredRole="teacher">
            <TeacherNodeConnections />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/add-user"
        element={
          <ProtectedRoute requiredRole="teacher">
            <AddUser />
          </ProtectedRoute>
        }
      />

      {/* ── Student ───────────────────────────────── */}
      <Route
        path="/student"
        element={
          <ProtectedRoute requiredRole="student">
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/assignments"
        element={
          <ProtectedRoute requiredRole="student">
            <Assignments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/assignments/:id"
        element={
          <ProtectedRoute requiredRole="student">
            <AssignmentDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/tasks"
        element={
          <ProtectedRoute requiredRole="student">
            <TaskStatus />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/results"
        element={
          <ProtectedRoute requiredRole="student">
            <Results />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/nodes"
        element={
          <ProtectedRoute requiredRole="student">
            <StudentNodeConnections />
          </ProtectedRoute>
        }
      />

      {/* ── Fallback ──────────────────────────────── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
