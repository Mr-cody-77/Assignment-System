import { centralRequest } from './api';
import { endpoints } from '../config/endpointResolver';

export const getAllTests = async () => {
  const res = await centralRequest.get(endpoints.tests());
  return res.data;
};

export const getTestById = async (id) => {
  const res = await centralRequest.get(endpoints.testById(id));
  return res.data;
};

export const startTest = async () => {
  const res = await centralRequest.post(endpoints.startTest());
  return res.data;
};

export const createTest = async (data) => {
  const res = await centralRequest.post(endpoints.createTest(), data);
  return res.data;
};

export const toggleTestLive = async (id) => {
  const res = await centralRequest.patch(endpoints.toggleTestLive(id));
  return res.data;
};

export const deleteTest = async (id) => {
    const res = await centralRequest.delete(endpoints.testById(id));
    return res.data;
};

export const updateTest = async (id, data) => {
    const res = await centralRequest.patch(endpoints.testById(id), data);
    return res.data;
};

export const generateTestCases = async (data) => {
  const res = await centralRequest.post(endpoints.aiGenerateTestCases(), data, { timeout: 120000 });
  return res.data;
};

export const submitTest = async (testId) => {
  const res = await centralRequest.post(endpoints.submitTest(), { test_id: testId });
  return res.data;
};

export const getSubmittedTests = async () => {
  const res = await centralRequest.get(endpoints.submitTest());
  return res.data;
};
