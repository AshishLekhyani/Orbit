"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "./hooks";
import { setSettings } from "./slices/settingsSlice";

const STORAGE_KEY = "orbit-settings";

export function SettingsPersistence() {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch(setSettings(JSON.parse(raw)));
    } catch {}
    hydrated.current = true;
  }, [dispatch]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  return null;
}
