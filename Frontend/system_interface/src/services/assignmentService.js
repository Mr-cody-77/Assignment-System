import { centralRequest, backendRequest } from './api';
import { endpoints } from '../config/endpointResolver';

/**
 * Fetch all questions/assignments.
 * GET /api/questions/
 * Response: array of { id, title, description, examples, constraints,
 *   test_cases:[{id, input_data, expected_output}],
 *   hidden_test_cases:[{id, input_data, expected_output}],
 *   created_at }
 */
export const getAllAssignments = async () => {
  const res = await backendRequest.get(endpoints.proxiedQuestions());
  return res.data;
};

/**
 * Fetch a single question by ID.
 * GET /api/questions/<id>/
 */
export const getAssignmentById = async (id) => {
  const res = await backendRequest.get(endpoints.proxiedQuestionById(id));
  return res.data;
};

/**
 * Create a new question (teacher only).
 * POST /api/questions/create/
 * Payload: {
 *   title,
 *   description,
 *   constraints,
 *   examples: [],           // array of {input, output, explanation}
 *   test_cases: [{input, output}],
 *   hidden_test_cases: [{input, output}]
 * }
 * Response: { message, question_id }
 */
export const createAssignment = async (data) => {
  const res = await centralRequest.post(endpoints.questions(), data);
  return res.data;
};

/**
 * Update an existing question (teacher only).
 * PATCH /api/questions/<id>/
 */
export const updateAssignment = async (id, data) => {
  const res = await centralRequest.patch(endpoints.questionById(id), data);
  return res.data;
};
