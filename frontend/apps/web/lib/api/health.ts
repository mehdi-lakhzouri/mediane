import { api } from "./client";

export interface ApiHealth {
  status: "ok";
  database: "up";
}

export function getApiHealth(): Promise<ApiHealth> {
  return api.get<ApiHealth>("/health");
}
