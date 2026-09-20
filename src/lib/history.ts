import type { SessionRecord, TimerMode } from "../types";

const STORAGE_KEY = "clockwork.history.v1";

function isSession(value: unknown): value is SessionRecord {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.taskId === "string" &&
    typeof entry.taskName === "string" &&
    typeof entry.durationMs === "number" &&
    Number.isFinite(entry.durationMs) &&
    entry.durationMs > 0 &&
    (entry.goalMs === undefined ||
      (typeof entry.goalMs === "number" && Number.isFinite(entry.goalMs) && entry.goalMs >= 0)) &&
    (entry.totalMs === undefined ||
      (typeof entry.totalMs === "number" && Number.isFinite(entry.totalMs) && entry.totalMs >= 0)) &&
    (entry.mode === "countdown" || entry.mode === "counter") &&
    typeof entry.completedAt === "string" &&
    (entry.activeMs === undefined ||
      (typeof entry.activeMs === "number" && Number.isFinite(entry.activeMs) && entry.activeMs >= 0)) &&
    (entry.focusedMs === undefined ||
      (typeof entry.focusedMs === "number" && Number.isFinite(entry.focusedMs) && entry.focusedMs >= 0)) &&
    (entry.distractedMs === undefined ||
      (typeof entry.distractedMs === "number" && Number.isFinite(entry.distractedMs) && entry.distractedMs >= 0)) &&
    (entry.compensatedMs === undefined ||
      (typeof entry.compensatedMs === "number" && Number.isFinite(entry.compensatedMs) && entry.compensatedMs >= 0)) &&
    typeof entry.startedAt === "string" &&
    Number.isFinite(Date.parse(entry.startedAt)) &&
    typeof entry.endedAt === "string" &&
    Number.isFinite(Date.parse(entry.endedAt)) &&
    (entry.isLive === undefined || typeof entry.isLive === "boolean")
  );
}

export function normalizeSession(entry: SessionRecord): SessionRecord {
  const startedAtMs = entry.startedAt ? Date.parse(entry.startedAt) : NaN;
  const endedAtMs = entry.endedAt ? Date.parse(entry.endedAt) : NaN;
  const timestampTotalMs = endedAtMs - startedAtMs;
  const totalMs = Math.max(0, Number.isFinite(timestampTotalMs) ? timestampTotalMs : entry.totalMs ?? entry.durationMs);
  const activeMs = Math.min(totalMs, Math.max(0, entry.activeMs ?? entry.durationMs));
  const compensatedMs = Math.max(0, entry.compensatedMs ?? entry.distractedMs ?? 0);
  const focusedMs = Math.max(0, activeMs - compensatedMs);
  return {
    ...entry,
    goalMs: Math.max(0, entry.goalMs ?? entry.durationMs),
    durationMs: totalMs,
    totalMs,
    activeMs,
    compensatedMs,
    distractedMs: compensatedMs,
    focusedMs,
  };
}

export function loadHistory(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .filter(isSession)
          .map((entry) => normalizeSession({ ...entry, isLive: false }))
      : [];
  } catch {
    return [];
  }
}

export function saveHistory(history: SessionRecord[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(history.slice(0, 200).map(normalizeSession)),
    );
  } catch {
    // Storage unavailable; history remains available for the current session.
  }
}

export function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createSession(
  taskId: string,
  taskName: string,
  durationMs: number,
  mode: TimerMode,
  metrics: Partial<
    Pick<SessionRecord, "id" | "activeMs" | "focusedMs" | "distractedMs" | "compensatedMs" | "totalMs" | "startedAt" | "endedAt" | "goalMs" | "isLive">
  > = {},
): SessionRecord {
  return normalizeSession({
    id: metrics.id ?? createSessionId(),
    taskId,
    taskName,
    durationMs,
    mode,
    completedAt: new Date().toISOString(),
    ...metrics,
  });
}
