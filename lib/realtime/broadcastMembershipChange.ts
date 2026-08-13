import { broadcastToProjectChannel } from "@/lib/realtime/broadcast";

export function broadcastMembershipChange(projectId: string, userId: string) {
  return broadcastToProjectChannel(projectId, "membership-changed", { userId });
}
