"use client";

import { useEffect } from "react";
import { useAppSelector } from "./hooks";

const STORAGE_KEY = "orbit-settings";

export function SettingsPersistence() {
  const settings = useAppSelector((state) => state.settings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  return null;
}
