import { centralRequest } from './api';
import { endpoints } from '../config/endpointResolver';

/**
 * Login to the Centralized Database Server.
 *
 * POST /api/users/login/
 * Payload : { username, password }
 * Response: { authenticated, role, username, access, refresh }
 */
export const login = async (username, password) => {
  const res = await centralRequest.post(
    endpoints.login(),
    { username, password },
    { skipAuth: true }
  );
  return res.data;
};
