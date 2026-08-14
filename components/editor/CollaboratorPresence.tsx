"use client";

import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setFollowing } from "@/store/slices/collaborationSlice";
import { initialsFor } from "@/lib/collaboratorColor";

const STATE_LABEL: Record<string, { text: string; color: string }> = {
  synced: { text: "Live", color: "var(--color-ok)" },
  syncing: { text: "Syncing", color: "var(--color-warn)" },
  reconnecting: { text: "Reconnecting", color: "var(--color-warn)" },
  offline: { text: "Offline", color: "var(--color-danger)" },
};

export function ConnectionStateIndicator() {
  const connectionState = useAppSelector((state) => state.collaboration.connectionState);
  const label = STATE_LABEL[connectionState] ?? STATE_LABEL.offline;

  return (
    <span className="ml-1.5 flex items-center gap-1.25 text-[11.5px]" style={{ color: label.color }}>
      <span className="block h-1.25 w-1.25 rounded-full" style={{ background: label.color }} />
      {label.text}
    </span>
  );
}

export function CollaboratorPresence() {
  const dispatch = useAppDispatch();
  const collaborators = useAppSelector((state) => state.collaboration.collaborators);
  const followingUserId = useAppSelector((state) => state.collaboration.followingUserId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (collaborators.length === 0) return null;

  return (
    <div className="flex items-center">
      {collaborators.map((collaborator) => {
        const fileName = collaborator.activeFilePath?.split("/").pop();
        const doing = fileName ? `Editing ${fileName}` : "Idle";
        const isFollowing = followingUserId === collaborator.userId;

        return (
          <span
            key={collaborator.userId}
            role="button"
            tabIndex={0}
            aria-pressed={isFollowing}
            aria-label={`${collaborator.name} — ${doing}${isFollowing ? " — following" : ""}`}
            onMouseEnter={() => setHoveredId(collaborator.userId)}
            onMouseLeave={() => setHoveredId(null)}
            onFocus={() => setHoveredId(collaborator.userId)}
            onBlur={() => setHoveredId(null)}
            onClick={() => dispatch(setFollowing(isFollowing ? null : collaborator.userId))}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                dispatch(setFollowing(isFollowing ? null : collaborator.userId));
              }
            }}
            title={`${collaborator.name} — ${doing}`}
            className="relative -ml-1.5 grid h-5.5 w-5.5 cursor-pointer place-items-center rounded-full text-[9.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent"
            style={{
              background: collaborator.color,
              color: "#0D0E10",
              border: `2px solid ${isFollowing ? collaborator.color : "#101114"}`,
            }}
          >
            {initialsFor(collaborator.name)}
            {hoveredId === collaborator.userId && (
              <span
                className="absolute top-7 right-[-6px] z-40 whitespace-nowrap rounded-sm border border-border-strong px-2.25 py-1.5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
                style={{ background: "#1B1D21" }}
              >
                <span className="block text-[11.5px] font-medium text-text-primary">{collaborator.name}</span>
                <span className="mt-0.5 block font-mono text-[10.5px] text-text-tertiary">{doing}</span>
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
