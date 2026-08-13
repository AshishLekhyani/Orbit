import type { Metadata } from "next";
import { PreviewWindowClient } from "./PreviewWindowClient";

export const metadata: Metadata = { title: "Preview — Orbit" };

export default function PreviewWindowPage() {
  return <PreviewWindowClient />;
}
