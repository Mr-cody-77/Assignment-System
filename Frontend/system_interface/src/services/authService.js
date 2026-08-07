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

export const changePassword = async (oldPassword, newPassword) => {
  const res = await centralRequest.post(endpoints.changePassword(), {
    old_password: oldPassword,
    new_password: newPassword,
  });
  return res.data;
};
