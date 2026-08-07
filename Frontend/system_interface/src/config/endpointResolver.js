import runtimeConfig from './runtimeConfig';

const central = () => runtimeConfig.getCentralURL();

/**
 * Central endpoint resolver.
 * All endpoint functions read from runtimeConfig at call-time,
 * so they always use the latest discovered URLs.
 *
 * Backend endpoints (task/status/nodes) use relative paths — the CRA
 * proxy in development forwards them to the backend, and in production
 * the React build is served from the backend itself (same origin).
 *
 * Central server endpoints (auth/questions/results) use absolute URLs
 * built from the discovered centralURL.
 */
export const endpoints = {
  // ── Auth (Central Server) ────────────────────────────────
  login: () => `${central()}/api/users/login/`,
  refresh: () => `${central()}/api/users/refresh/`,
  addStudent: () => `${central()}/api/users/add_student/`,
  addTeacher: () => `${central()}/api/users/add_teacher/`,
  updateEmail: () => `${central()}/api/users/update_email/`,
  changePassword: () => `${central()}/api/users/change_password/`,

  // ── Tests & Questions (Central Server) ───────────────────
  tests: () => `${central()}/api/tests/`,
  testById: (id) => `${central()}/api/tests/${id}/`,
  createTest: () => `${central()}/api/tests/create/`,
  toggleTestLive: (id) => `${central()}/api/tests/${id}/toggle-live/`,
  activeTest: () => `${central()}/api/tests/active/`,
  submitTest: () => `${central()}/api/tests/submit/`,
  questions: () => `${central()}/api/questions/`,
  startTest: () => `${central()}/api/tests/start/`,
  questionById: (id) => `${central()}/api/questions/${id}/`,
  aiGenerateTestCases: () => `${central()}/api/ai/generate/`,

  // ── Results (Central Server) ─────────────────────────────
  results: () => `${central()}/api/results/result/`,
  codeHistory: () => `${central()}/api/results/code-history/`,

  // ── Schedule (Central Server) ────────────────────────────
  schedule: () => `${central()}/api/schedule/`,

  // ── Tasks (Backend Node Server — relative URLs) ──────────
  submitTask: () =>
    `${runtimeConfig.getBackendURL()}/api/task/`,

  taskStatus: () =>
    `${runtimeConfig.getBackendURL()}/api/task_status/`,

  nodeInfo: () =>
    `${runtimeConfig.getBackendURL()}/api/node_info/`,

  // ── Plagiarism Detection (Central Server) — new, isolated ─
  plagiarismTeacher: () => `${central()}/api/results/plagiarism/teacher/`,
  plagiarismStudent: () => `${central()}/api/results/plagiarism/student/`,
};

