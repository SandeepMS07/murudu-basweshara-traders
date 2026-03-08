export type Role = "admin" | "operator";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
}

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
}
