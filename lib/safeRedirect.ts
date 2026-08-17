const DEFAULT_DESTINATION = "/dashboard";
const SLASH = "/";

export function safeRedirectPath(value: string | null | undefined): string {
  if (!value) return DEFAULT_DESTINATION;
  if (value.charAt(0) !== SLASH) return DEFAULT_DESTINATION;
  if (value.charAt(1) === SLASH) return DEFAULT_DESTINATION;
  if (value.charAt(1) === "\\") return DEFAULT_DESTINATION;
  return value;
}
