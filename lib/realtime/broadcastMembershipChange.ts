import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export async function broadcastMembershipChange(projectId: string, userId: string) {
  const supabase = createServiceRoleClient();
  const channel = supabase.channel(`project-${projectId}`, { config: { private: true } });
  try {
    await channel.httpSend("membership-changed", { userId });
  } finally {
    await supabase.removeChannel(channel);
  }
}
