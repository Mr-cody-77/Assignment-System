import { backendRequest } from './api';
import { endpoints } from '../config/endpointResolver';

/**
 * Submit a coding task to the Backend Node Server.
 *
 * POST /api/task/
 * Payload: {
 *   roll_number : string   — student's roll number
 *   question    : object   — full question payload including test cases
 *   language    : string   — 'python' | 'cpp' | 'java' | 'javascript'
 *   solution    : string   — source code (NOT source_code, the field name is 'solution')
 * }
 * Response: { task_id, status }
 */
export const submitTask = async ({ roll_number, question, language, solution }) => {
  const res = await backendRequest.post(endpoints.submitTask(), {
    roll_number,
    question,
    language,
    solution,
  });
  return res.data;
};

/**
 * Fetch all task statuses.
 *
 * GET /api/task_status/
 * Response: array of {
 *   task_id, question_id, roll_number, status,
 *   assigned_node, created_at, updated_at, result
 * }
 */
export const getTaskStatus = async () => {
  const res = await backendRequest.get(endpoints.taskStatus());
  return res.data;
};
