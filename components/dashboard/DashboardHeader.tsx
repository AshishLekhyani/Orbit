"use client";

import { useEffect, useRef, useState } from "react";
import { OrbitLogo } from "@/components/shared/OrbitLogo";
import { SettingsModal } from "./SettingsModal";

interface DashboardHeaderProps {
  email: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSignOut: () => void;
}

function getInitials(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase() || "?";
}

export function DashboardHeader({ email, search, onSearchChange, onSignOut }: DashboardHeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-10 flex h-13 items-center justify-between border-b border-border-subtle bg-bg-editor px-6">
      <div className="flex items-center gap-2.5">
        <OrbitLogo size={20} />
        <span className="text-[13px] font-semibold text-text-primary">Orbit</span>
      </div>

      <div className="relative mx-8 max-w-100 flex-1">
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search projects…"
          className="h-7.5 w-full rounded-sm border border-[#24262B] bg-bg-raised pr-2.75 pl-7.5 text-ui text-text-primary outline-none focus:border-[#3A3D44] focus:bg-[#1A1C20]"
        />
        <span className="pointer-events-none absolute top-2 left-2.5 h-2.75 w-2.75 rounded-full border-[1.4px] border-text-muted" />
        <span className="pointer-events-none absolute top-1.5 right-2.25 rounded-xs border border-[#26282D] px-1.25 py-px font-mono text-[10px] text-syntax-comment">
          ⌘P
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setSettingsOpen(true)}
          className="text-ui text-text-tertiary hover:text-text-primary"
        >
          Settings
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((value) => !value)}
            title={email}
            className="grid h-6.5 w-6.5 place-items-center rounded-full bg-accent text-[10.5px] font-semibold text-on-accent"
          >
            {getInitials(email)}
          </button>

          {menuOpen && (
            <div className="absolute top-9 right-0 z-20 w-52 rounded-md border border-border-strong bg-bg-raised p-1.25 shadow-[0_16px_40px_rgba(0,0,0,0.55)]">
              <div className="truncate px-2 py-1.5 text-xs text-text-muted">{email}</div>
              <button
                onClick={onSignOut}
                className="w-full rounded-sm px-2 py-1.5 text-left text-ui text-text-primary hover:bg-[#22242A]"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
