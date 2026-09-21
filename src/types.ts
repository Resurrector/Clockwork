export type Preset = {
  id: string;
  label: string;
  seconds: number;
};

export type Task = {
  id: string;
  name: string;
  goal?: TaskGoal;
  presetTimeMs?: number;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
};

export type TaskGoal = {
  type: "repeating" | "once";
  duration: "daily" | "weekly" | "custom";
  customDays?: number;
  startDate: string;
  amountMs: number;
};

export type AppView = "timer" | "tasks" | "history";

export type TimerMode = "countdown" | "counter";

export type SessionRecord = {
  id: string;
  taskId: string;
  taskName: string;
  durationMs: number;
  /** Goal duration selected when the session was started. */
  goalMs?: number;
  /** Wall-clock duration from session start through session end. */
  totalMs?: number;
  mode: TimerMode;
  completedAt: string;
  /** Time spent while the timer was running (as opposed to paused). */
  activeMs?: number;
  /** Time counted as focused work for this session. */
  focusedMs?: number;
  /** Time counted as distracted work for this session. */
  distractedMs?: number;
  /** Manual compensation applied while the session was running. */
  compensatedMs?: number;
  /** Timestamp at which this timer session was first started. */
  startedAt?: string;
  /** Timestamp at which this timer session ended. */
  endedAt?: string;
  /** True while this session is still in progress. */
  isLive?: boolean;
};
