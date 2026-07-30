import { centralRequest } from './api';
import { endpoints } from '../config/endpointResolver';

/**
 * Add a new student (teacher only, requires Bearer token).
 *
 * POST /api/users/add_student/
 * Payload  : { roll_number }
 * Response : { success, username, password }
 *   — username and password are both set to roll_number by the backend
 */
export const addStudent = async (roll_number) => {
  const res = await centralRequest.post(endpoints.addStudent(), { roll_number });
  return res.data;
};

/**
 * Add a new teacher account (teacher only, requires Bearer token).
 *
 * POST /api/users/add_teacher/
 * Payload  : { username, password }
 * Response : { success, username, role }
 */
export const addTeacher = async (username, password) => {
  const res = await centralRequest.post(endpoints.addTeacher(), { username, password });
  return res.data;
};

/**
 * Update the preferred email for the logged-in student.
 */
export const updateUserEmail = async (email) => {
  const res = await centralRequest.post(endpoints.updateEmail(), { email });
  return res.data;
};
