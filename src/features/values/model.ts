import type { IconName } from "@/core/lib/icon-names";

export interface Value {
  id: string;
  name: string;
  icon: IconName;
  /** monochrome ink hue (B&W cockpit) */
  hue: string;
  /** spectrum color key (map orbs / galaxy / globe / light variants) */
  spectrum: string;
  /** 0..1 — how charged/important this value feels right now (editable, seeded) */
  energy: number;
  desc: string;
  order: number;
}
