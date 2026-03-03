import client from "./client";

export const getTasks = (projectId) =>
  client.get(`/projects/${projectId}/tasks`).then((r) => r.data);

export const createTask = (projectId, data) =>
  client.post(`/projects/${projectId}/tasks`, data).then((r) => r.data);

export const updateTask = (projectId, taskId, data) =>
  client
    .put(`/projects/${projectId}/tasks/${taskId}`, data)
    .then((r) => r.data);

export const deleteTask = (projectId, taskId) =>
  client
    .delete(`/projects/${projectId}/tasks/${taskId}`)
    .then((r) => r.data);
