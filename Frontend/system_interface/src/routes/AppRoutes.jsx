import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';

// Public pages
import Landing from '../pages/Landing/Landing';
import Login from '../pages/Login/Login';
import NodeConnections from '../pages/NodeConnections/NodeConnections';

// Teacher pages
import TeacherDashboard from '../pages/teacher/TeacherDashboard.jsx';
import TeacherTests from '../pages/teacher/TeacherTests';
import TeacherTestDetails from '../pages/teacher/TeacherTestDetails';
import CreateTest from '../pages/teacher/CreateTest';
import StudentResults from '../pages/teacher/StudentResults';
import TeacherNodeConnections from '../pages/teacher/TeacherNodeConnections';
import AddUser from '../pages/teacher/AddUser';
import AnalyticsPage from '../pages/teacher/AnalyticsPage';
import CodeReview from '../pages/teacher/CodeReview';

// Student pages
import StudentDashboard from '../pages/student/StudentDashboard.jsx';
import TestQuestions from '../pages/student/TestQuestions';
import AssignmentDetails from '../pages/student/AssignmentDetails';
import TaskStatus from '../pages/student/TaskStatus';
import Results from '../pages/student/Results';
import StudentNodeConnections from '../pages/student/StudentNodeConnections';
import StartExam from '../pages/student/StartExam';

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
        path="/teacher/tests"
        element={
          <ProtectedRoute requiredRole="teacher">
            <TeacherTests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/tests/:id"
        element={
          <ProtectedRoute requiredRole="teacher">
            <TeacherTestDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/create-test"
        element={
          <ProtectedRoute requiredRole="teacher">
            <CreateTest />
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
      <Route
        path="/teacher/code-review"
        element={
          <ProtectedRoute requiredRole="teacher">
            <CodeReview />
          </ProtectedRoute>
        }
      />

      {/* ── Student ───────────────────────────────── */}
      <Route
        path="/student/start-exam"
        element={
          <ProtectedRoute requiredRole="student">
            <StartExam />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student"
        element={
          <ProtectedRoute requiredRole="student">
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/tests"
        element={
          <ProtectedRoute requiredRole="student">
            <TestQuestions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/tests/question/:id"
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
