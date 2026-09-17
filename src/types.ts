export type Preset = {
  id: string;
  label: string;
  seconds: number;
};

export type Task = {
  id: string;
  name: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
};

export type AppView = "timer" | "tasks" | "history";
