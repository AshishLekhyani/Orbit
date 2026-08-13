"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { useToast } from "@/components/shared/ToastProvider";
import { colorForUserId, initialsFor } from "@/lib/collaboratorColor";
import {
  useGetMembersQuery,
  useInviteMemberMutation,
  useUpdateMemberRoleMutation,
  useRemoveMemberMutation,
  useGetShareLinkQuery,
  useSetShareLinkMutation,
  useRevokeShareLinkMutation,
  useRegenerateShareLinkMutation,
  type ShareRole,
} from "@/store/api/sharingApi";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

export function ShareModal({ open, onClose, projectId, projectName }: ShareModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={`Share ${projectName}`}>
      {open && <ShareModalContent projectId={projectId} projectName={projectName} onClose={onClose} />}
    </Modal>
  );
}

function Avatar({ userId, name }: { userId: string; name: string }) {
  return (
    <span
      className="grid h-6.5 w-6.5 flex-none place-items-center rounded-full text-[10px] font-semibold"
      style={{ background: colorForUserId(userId), color: "#0D0E10" }}
    >
      {initialsFor(name)}
    </span>
  );
}

function ShareModalContent({
  projectId,
  projectName,
  onClose,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { data: membersData, isLoading: membersLoading } = useGetMembersQuery(projectId);
  const { data: linkData, isLoading: linkLoading } = useGetShareLinkQuery(projectId);
  const [inviteMember, { isLoading: inviting }] = useInviteMemberMutation();
  const [updateMemberRole] = useUpdateMemberRoleMutation();
  const [removeMember] = useRemoveMemberMutation();
  const [setShareLink, { isLoading: settingLink }] = useSetShareLinkMutation();
  const [revokeShareLink] = useRevokeShareLinkMutation();
  const [regenerateShareLink, { isLoading: regenerating }] = useRegenerateShareLinkMutation();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ShareRole>("EDITOR");

  async function handleInvite() {
    const email = inviteEmail.trim();
    if (!email) return;
    try {
      await inviteMember({ projectId, email, role: inviteRole }).unwrap();
      setInviteEmail("");
      toast(`Invited ${email}`);
    } catch (error) {
      const message =
        error && typeof error === "object" && "data" in error
          ? ((error.data as { error?: string })?.error ?? "Could not send invite")
          : "Could not send invite";
      toast(message, undefined, "danger");
    }
  }

  async function handleRoleChange(memberId: string, role: ShareRole) {
    try {
      await updateMemberRole({ projectId, memberId, role }).unwrap();
    } catch {
      toast("Could not update role", undefined, "danger");
    }
  }

  async function handleRemove(memberId: string, name: string) {
    try {
      await removeMember({ projectId, memberId }).unwrap();
      toast(`Removed ${name}`);
    } catch {
      toast("Could not remove member", undefined, "danger");
    }
  }

  async function handleLinkRoleChange(value: "RESTRICTED" | ShareRole) {
    try {
      if (value === "RESTRICTED") {
        await revokeShareLink(projectId).unwrap();
      } else {
        await setShareLink({ projectId, permission: value }).unwrap();
      }
    } catch {
      toast("Could not update link access", undefined, "danger");
    }
  }

  async function handleRegenerate() {
    try {
      await regenerateShareLink(projectId).unwrap();
      toast("Link regenerated — old link no longer works");
    } catch {
      toast("Could not regenerate link", undefined, "danger");
    }
  }

  async function handleCopyLink() {
    if (!linkData?.link) return;
    const url = `${window.location.origin}/share/${linkData.link.token}`;
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  }

  const link = linkData?.link ?? null;
  const linkValue: "RESTRICTED" | ShareRole = link ? link.permission : "RESTRICTED";
  const linkNote = link
    ? link.permission === "EDITOR"
      ? "Anyone with the link can edit"
      : "Anyone with the link can view"
    : "Only people with access can open this project";

  return (
    <>
      <div className="px-5 pt-4.5 pb-3.5">
        <div className="text-[14.5px] font-semibold text-text-primary">Share “{projectName}”</div>
        <div className="mt-0.75 text-ui text-text-tertiary">Anyone invited can open this project in Orbit.</div>
      </div>

      <div className="px-5 pb-3.5">
        <div className="mb-2 text-[10.5px] font-semibold tracking-[0.12em] text-text-muted uppercase">
          People with access
        </div>
        {membersLoading && <div className="py-2 text-ui text-text-tertiary">Loading…</div>}
        {membersData && (
          <div>
            <div className="flex items-center gap-2.5 py-1.75">
              <Avatar userId={membersData.owner.id} name={membersData.owner.name} />
              <div className="min-w-0">
                <div className="truncate text-ui text-text-primary">{membersData.owner.name}</div>
                <div className="truncate text-meta text-text-muted">{membersData.owner.email}</div>
              </div>
              <select
                disabled
                value="OWNER"
                className="ml-auto cursor-not-allowed rounded-sm border border-border-strong bg-transparent px-1.75 py-1 text-ui text-text-tertiary outline-none"
              >
                <option value="OWNER">Owner</option>
              </select>
            </div>
            {membersData.members.map((member) => (
              <div key={member.id} className="group flex items-center gap-2.5 py-1.75">
                <Avatar userId={member.userId} name={member.name} />
                <div className="min-w-0">
                  <div className="truncate text-ui text-text-primary">{member.name}</div>
                  <div className="truncate text-meta text-text-muted">{member.email}</div>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <select
                    value={member.role}
                    onChange={(event) => handleRoleChange(member.id, event.target.value as ShareRole)}
                    className="rounded-sm border border-border-strong bg-bg-editor px-1.75 py-1 text-ui text-text-primary outline-none cursor-pointer"
                  >
                    <option value="EDITOR">Editor</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <button
                    onClick={() => handleRemove(member.id, member.name)}
                    title="Remove access"
                    className="grid h-6 w-6 flex-none place-items-center rounded-sm text-text-faint opacity-0 hover:bg-[#22242A] hover:text-danger-text group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="h-px bg-[#22242A]" />

      <div className="px-5 py-4">
        <div className="mb-2 text-[10.5px] font-semibold tracking-[0.12em] text-text-muted uppercase">
          Invite people
        </div>
        <div className="flex gap-2">
          <input
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleInvite()}
            placeholder="email@example.com"
            className="h-8.5 flex-1 rounded-btn border border-border-strong bg-bg-editor px-2.5 text-ui text-text-primary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/[0.14]"
          />
          <select
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value as ShareRole)}
            className="h-8.5 rounded-btn border border-border-strong bg-bg-editor px-2 text-ui text-text-primary outline-none cursor-pointer"
          >
            <option value="EDITOR">Editor</option>
            <option value="VIEWER">Viewer</option>
          </select>
          <Button size="sm" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
            {inviting ? "Sending…" : "Send invite"}
          </Button>
        </div>
      </div>

      <div className="h-px bg-[#22242A]" />

      <div className="px-5 py-4">
        <div className="mb-2.5 text-[10.5px] font-semibold tracking-[0.12em] text-text-muted uppercase">
          General access
        </div>
        <div className="flex items-center gap-2.5">
          <span className="grid h-6.5 w-6.5 flex-none place-items-center rounded-full border border-border-strong text-ui text-text-tertiary">
            ⚯
          </span>
          <div className="min-w-0">
            <div className="text-ui text-text-primary">Anyone with the link</div>
            <div className="truncate text-meta text-text-muted">{linkLoading ? "Loading…" : linkNote}</div>
          </div>
          <select
            value={linkValue}
            disabled={settingLink}
            onChange={(event) => handleLinkRoleChange(event.target.value as "RESTRICTED" | ShareRole)}
            className="ml-auto rounded-sm border border-border-strong bg-bg-editor px-1.75 py-1 text-ui text-text-primary outline-none cursor-pointer"
          >
            <option value="RESTRICTED">Restricted</option>
            <option value="VIEWER">Can view</option>
            <option value="EDITOR">Can edit</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[#22242A] px-5 py-3.5">
        <Button variant="secondary" size="sm" onClick={handleCopyLink} disabled={!link}>
          Copy link
        </Button>
        {link && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            title="Regenerate link"
            className="rounded-sm border border-border-strong bg-bg-editor px-2.5 py-1.5 text-ui text-text-tertiary hover:border-[#3A3D44] hover:text-text-primary"
          >
            {regenerating ? "…" : "↻"}
          </button>
        )}
        <div className="flex-1" />
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </>
  );
}
