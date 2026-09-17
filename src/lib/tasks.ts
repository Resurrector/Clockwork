import type { Task } from "../types";

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

function isValidTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  const task = value as Record<string, unknown>;
  return (
    typeof task.id === "string" &&
    task.id.length > 0 &&
    typeof task.name === "string" &&
    task.name.trim().length > 0 &&
    typeof task.pinned === "boolean" &&
    typeof task.archived === "boolean" &&
    typeof task.createdAt === "string"
  );
}

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return defaultTasks();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultTasks();
    const valid = parsed.filter(isValidTask);
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
