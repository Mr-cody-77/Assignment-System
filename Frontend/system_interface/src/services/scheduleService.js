import { centralRequest } from './api';
import { endpoints } from '../config/endpointResolver';

export const getSchedule = async () => {
  const { data } = await centralRequest.get(endpoints.schedule());
  return data.schedule;
};

export const setSchedule = async (startTime, endTime) => {
  const { data } = await centralRequest.post(
    endpoints.schedule(),
    { start_time: startTime, end_time: endTime }
  );
  return data.schedule;
};
