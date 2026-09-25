import type { Task, TaskGoal } from "../types";

const STORAGE_KEY = "clockwork.tasks.v1";

export function createTaskId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultTasks(): Task[] {
  return [];
}

function isGoal(value: unknown): value is TaskGoal {
  if (typeof value !== "object" || value === null) return false;
  const goal = value as Record<string, unknown>;
  return (
    (goal.type === "repeating" || goal.type === "once") &&
    (goal.duration === "daily" || goal.duration === "weekly" || goal.duration === "custom") &&
    typeof goal.startDate === "string" &&
    Number.isFinite(Date.parse(goal.startDate)) &&
    typeof goal.amountMs === "number" &&
    Number.isFinite(goal.amountMs) &&
    goal.amountMs > 0 &&
    (goal.duration !== "custom" ||
      (typeof goal.customDays === "number" && Number.isInteger(goal.customDays) && goal.customDays >= 1 && goal.customDays <= 31))
  );
}

function isValidTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  const task = value as Record<string, unknown>;
  return (
    typeof task.id === "string" &&
    task.id.length > 0 &&
    typeof task.name === "string" &&
    task.name.trim().length > 0 &&
    (task.goal === undefined || isGoal(task.goal)) &&
    (task.presetTimeMs === undefined ||
      (typeof task.presetTimeMs === "number" && Number.isFinite(task.presetTimeMs) && task.presetTimeMs > 0)) &&
    typeof task.archived === "boolean" &&
    typeof task.createdAt === "string"
  );
}

function normalizeTask(value: Record<string, unknown>): Task {
  const legacyGoal = value.goal as Record<string, unknown> | undefined;
  const goal: TaskGoal | undefined = isGoal(legacyGoal)
    ? legacyGoal
    : legacyGoal &&
        typeof legacyGoal.amountMs === "number" &&
        legacyGoal.amountMs > 0
      ? {
          type: "repeating",
          duration: typeof legacyGoal.durationDays === "number" && legacyGoal.durationDays > 1 ? "custom" : "daily",
          customDays:
            typeof legacyGoal.durationDays === "number" && legacyGoal.durationDays > 1
              ? Math.min(31, Math.max(1, Math.floor(legacyGoal.durationDays)))
              : undefined,
          startDate: new Date().toISOString().slice(0, 10),
          amountMs: legacyGoal.amountMs,
        }
      : undefined;
  return {
    id: value.id as string,
    name: (value.name as string).trim(),
    ...(goal ? { goal } : {}),
    ...(typeof value.presetTimeMs === "number" && value.presetTimeMs > 0
      ? { presetTimeMs: value.presetTimeMs }
      : {}),
    archived: value.archived as boolean,
    createdAt: value.createdAt as string,
  };
}

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return defaultTasks();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultTasks();
    const valid = parsed
      .filter((value): value is Record<string, unknown> => typeof value === "object" && value !== null)
      .filter((value) => {
        if (isValidTask(value)) return true;
        return (
          typeof value.id === "string" &&
          typeof value.name === "string" &&
          value.name.trim().length > 0 &&
          typeof value.archived === "boolean" &&
          typeof value.createdAt === "string"
        );
      })
      .map(normalizeTask);
    return valid.length > 0 ? valid : defaultTasks();
  } catch {
    return defaultTasks();
  }
}

export function saveTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Storage unavailable; tasks simply won't persist.
  }
}
