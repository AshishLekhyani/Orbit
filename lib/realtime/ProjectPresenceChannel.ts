import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Collaborator } from "@/store/slices/collaborationSlice";
import type { LocalUser } from "./SupabaseYjsProvider";

interface ProjectPresenceOptions {
  supabase: SupabaseClient;
  projectId: string;
  localUser: LocalUser;
  onCollaboratorsChange: (collaborators: Collaborator[]) => void;
  onMembershipChanged?: (userId: string) => void;
  onFilesChanged?: () => void;
}

interface PresenceState {
  userId: string;
  name: string;
  color: string;
  activeFileId: string | null;
  activeFilePath: string | null;
}

export class ProjectPresenceChannel {
  private supabase: SupabaseClient;
  private localUser: LocalUser;
  private onCollaboratorsChange: (collaborators: Collaborator[]) => void;
  private channel: RealtimeChannel | null = null;
  private destroyed = false;
  private tracked: PresenceState;

  constructor(options: ProjectPresenceOptions) {
    this.supabase = options.supabase;
    this.localUser = options.localUser;
    this.onCollaboratorsChange = options.onCollaboratorsChange;
    this.tracked = {
      userId: options.localUser.id,
      name: options.localUser.name,
      color: options.localUser.color,
      activeFileId: null,
      activeFilePath: null,
    };

    const channel = this.supabase.channel(`project-${options.projectId}`, {
      config: {
        private: true,
        presence: { key: options.localUser.id },
      },
    });

    const syncCollaborators = () => this.syncCollaborators();
    channel.on("presence", { event: "sync" }, syncCollaborators);
    channel.on("presence", { event: "join" }, syncCollaborators);
    channel.on("presence", { event: "leave" }, syncCollaborators);

    if (options.onMembershipChanged) {
      channel.on("broadcast", { event: "membership-changed" }, ({ payload }) => {
        if (typeof payload?.userId === "string") options.onMembershipChanged?.(payload.userId);
      });
    }

    if (options.onFilesChanged) {
      channel.on("broadcast", { event: "files-changed" }, () => {
        options.onFilesChanged?.();
      });
    }

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" && !this.destroyed) {
        channel.track(this.tracked);
      }
    });

    this.channel = channel;
  }

  private syncCollaborators() {
    if (!this.channel) return;
    const state = this.channel.presenceState<PresenceState>();
    const collaborators: Collaborator[] = [];

    for (const [key, entries] of Object.entries(state)) {
      if (key === this.localUser.id) continue;
      const latest = entries[entries.length - 1];
      if (!latest) continue;
      collaborators.push({
        userId: latest.userId,
        name: latest.name,
        color: latest.color,
        activeFileId: latest.activeFileId,
        activeFilePath: latest.activeFilePath,
      });
    }

    this.onCollaboratorsChange(collaborators);
  }

  setActiveFile(fileId: string | null, path: string | null) {
    this.tracked = { ...this.tracked, activeFileId: fileId, activeFilePath: path };
    if (this.channel) this.channel.track(this.tracked);
  }

  destroy() {
    this.destroyed = true;
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
