import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

async function broadcast(topic: string, event: string, payload: Record<string, unknown>) {
  const supabase = createServiceRoleClient();
  const channel = supabase.channel(topic, { config: { private: true } });
  try {
    await channel.httpSend(event, payload);
  } finally {
    await supabase.removeChannel(channel);
  }
}

export function broadcastToProjectChannel(projectId: string, event: string, payload: Record<string, unknown>) {
  return broadcast(`project-${projectId}`, event, payload);
}

export function broadcastToFileChannel(fileId: string, event: string, payload: Record<string, unknown>) {
  return broadcast(`file-${fileId}`, event, payload);
}
