import type { Preset } from "../types";

const STORAGE_KEY = "clockwork.presets.v1";

/** Simple unique ID without dependencies (randomUUID with a fallback). */
export function createPresetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Defaults used the very first time the app runs. */
function defaultPresets(): Preset[] {
  return [
    { id: createPresetId(), label: "Focus", seconds: 20 * 60 },
    { id: createPresetId(), label: "Short Break", seconds: 5 * 60 },
    { id: createPresetId(), label: "Deep Work", seconds: 50 * 60 },
  ];
}

function isValidPreset(value: unknown): value is Preset {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    p.id.length > 0 &&
    typeof p.label === "string" &&
    p.label.length > 0 &&
    typeof p.seconds === "number" &&
    Number.isFinite(p.seconds) &&
    p.seconds > 0
  );
}

/**
 * Loads presets from localStorage. Returns defaults on first run and an
 * empty list if the stored data is missing or invalid.
 */
export function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return defaultPresets();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPreset);
  } catch {
    return [];
  }
}

/** Persists the full preset list. */
export function savePresets(presets: Preset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Storage unavailable (quota/denied) — presets just won't persist.
  }
}
