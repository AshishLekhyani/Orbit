import { randomBytes } from "crypto";

export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}
