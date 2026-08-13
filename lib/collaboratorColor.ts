const COLLABORATOR_COLORS = [
  "#6E9BD8",
  "#C98A6A",
  "#6EA57E",
  "#D9A85C",
  "#C46B6B",
  "#8FB8D9",
  "#A9C48E",
  "#C9A0C9",
];

export function colorForUserId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return COLLABORATOR_COLORS[hash % COLLABORATOR_COLORS.length];
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
