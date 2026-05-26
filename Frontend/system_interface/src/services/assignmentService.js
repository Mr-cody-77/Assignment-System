import { centralRequest } from './api';
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
  const res = await centralRequest.get(endpoints.questions());
  return res.data;
};

/**
 * Fetch a single question by ID.
 * GET /api/questions/<id>/
 */
export const getAssignmentById = async (id) => {
  const res = await centralRequest.get(endpoints.questionById(id));
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
  const res = await centralRequest.post(endpoints.createQuestion(), data);
  return res.data;
};
