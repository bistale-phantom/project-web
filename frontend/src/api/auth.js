import client from "./client";

export const register = (email, password, name) =>
  client.post("/register", { email, password, name }).then((r) => r.data);

export const login = (email, password) =>
  client.post("/login", { email, password }).then((r) => r.data);

export const getMe = () => client.get("/me").then((r) => r.data);

export const updateProfile = (data) =>
  client.put("/me", data).then((r) => r.data);
