import { useMemo, useState, type FormEvent } from "react";
import type { Task, TaskGoal } from "../types";
import { formatDuration } from "../lib/time";

interface TaskViewProps {
  tasks: Task[];
  selectedTaskId: string;
  onSelectTask: (taskId: string) => void;
  onAddTask: (name: string, goal?: TaskGoal, presetTimeMs?: number) => void;
  onUpdateTask: (taskId: string, changes: Partial<Pick<Task, "name" | "goal" | "presetTimeMs" | "pinned" | "archived">>) => void;
  onDeleteTask: (taskId: string) => void;
}

type Draft = {
  name: string;
  type: TaskGoal["type"];
  duration: TaskGoal["duration"];
  customDays: string;
  startDate: string;
  amountHours: string;
  amountDays: string;
  amountMinutes: string;
  amountSeconds: string;
  presetHours: string;
  presetMinutes: string;
  presetSeconds: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const draftFromTask = (task?: Task): Draft => {
  const goal = task?.goal;
  const amount = goal?.amountMs ?? 0;
  const preset = task?.presetTimeMs ?? 0;
  return {
    name: task?.name ?? "",
    type: goal?.type ?? "repeating",
    duration: goal?.duration ?? "daily",
    customDays: String(goal?.customDays ?? 1),
    startDate: goal?.startDate ?? today(),
    amountHours: String(Math.floor((amount % 86_400_000) / 3_600_000)),
    amountDays: String(Math.floor(amount / 86_400_000)),
    amountMinutes: String(Math.floor((amount % 3_600_000) / 60_000)),
    amountSeconds: String(Math.floor((amount % 60_000) / 1000)),
    presetHours: String(Math.floor(preset / 3_600_000)),
    presetMinutes: String(Math.floor((preset % 3_600_000) / 60_000)),
    presetSeconds: String(Math.floor((preset % 60_000) / 1000)),
  };

};

const periodDaysForDraft = (draft: Draft) =>
  draft.duration === "daily" ? 1 : draft.duration === "weekly" ? 7 : Math.max(1, Number(draft.customDays) || 1);

function timeMs(hours: string, minutes: string, seconds: string) {
  const h = Number(hours);
  const m = Number(minutes);
  const s = Number(seconds);
  if (![h, m, s].every(Number.isInteger) || h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
  return h * 3_600_000 + m * 60_000 + s * 1000;
}

export function TaskView({ tasks, selectedTaskId, onSelectTask, onAddTask, onUpdateTask, onDeleteTask }: TaskViewProps) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(draftFromTask());
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);

  const visibleTasks = useMemo(() => tasks.filter((task) => task.archived === showArchived && task.name.toLowerCase().includes(query.trim().toLowerCase())), [query, showArchived, tasks]);
  const openEditor = (task?: Task) => {
    setDraft(draftFromTask(task));
    setEditingId(task?.id ?? null);
    setError("");
    setShowForm(true);
    setOpenActionsId(null);
  };
  const closeEditor = () => {
    setShowForm(false);
    setEditingId(null);
    setError("");
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    const amountMs = timeMs(draft.amountHours, draft.amountMinutes, draft.amountSeconds);
    const presetTimeMs = timeMs(draft.presetHours, draft.presetMinutes, draft.presetSeconds);
    const days = Number(draft.customDays);
    const periodDays = draft.duration === "daily" ? 1 : draft.duration === "weekly" ? 7 : days;
    const amountDays = Number(draft.amountDays);
    const amountWithDays = amountMs === null ? null : amountMs + amountDays * 86_400_000;
    if (!draft.name.trim() || amountWithDays === null || amountDays < 0 || !Number.isInteger(amountDays) || amountWithDays <= 0 || amountWithDays > periodDays * 86_400_000 || presetTimeMs === null || days < 1 || days > 31 || !Number.isInteger(days) || !/^\d{4}-\d{2}-\d{2}$/.test(draft.startDate)) {
      setError("Enter a name, valid goal time, start date, and values within the allowed ranges.");
      return;
    }
    const goal: TaskGoal = {
      type: draft.type,
      duration: draft.duration,
      ...(draft.duration === "custom" ? { customDays: days } : {}),
      startDate: draft.startDate,
      amountMs: amountWithDays,
    };
    const changes = { name: draft.name.trim(), goal, ...(presetTimeMs > 0 ? { presetTimeMs } : { presetTimeMs: undefined }) };
    if (editingId) onUpdateTask(editingId, changes);
    else onAddTask(draft.name.trim(), goal, presetTimeMs > 0 ? presetTimeMs : undefined);
    closeEditor();
  };
  const set = (key: keyof Draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <section className="glass-card tasks-view">
      <div className="tasks-header">
        <h2>Tasks</h2>
        <button type="button" className="task-add-trigger" onClick={() => (showForm ? closeEditor() : openEditor())}>{showForm ? "Close" : "+ Add Task"}</button>
        <button type="button" className="task-archive-toggle" onClick={() => setShowArchived((value) => !value)}>{showArchived ? "Active tasks" : "Archived"}</button>
      </div>
      <label className="task-search" htmlFor="task-search"><span className="task-search-label">Search tasks</span><input id="task-search" type="text" placeholder="Search tasks..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {showForm && (
        <form className="task-settings-panel" onSubmit={save}>
          <div className="task-settings-heading"><div><span className="field-label">{editingId ? "Task settings" : "New task"}</span><h3>{editingId ? "Edit task" : "Create task"}</h3></div><button type="button" className="task-settings-close" onClick={closeEditor}>×</button></div>
          <label className="task-setting-wide"><span>Name</span><input type="text" maxLength={60} value={draft.name} onChange={(event) => set("name", event.target.value)} /></label>
          <div className="task-goal-section"><div className="task-goal-section-title">Task goal</div><div className="task-goal-grid">
            <label><span>Type</span><select value={draft.type} onChange={(event) => { const type = event.target.value as TaskGoal["type"]; setDraft((current) => ({ ...current, type, duration: type === "once" ? "custom" : current.duration })); }}><option value="repeating">Repeating</option><option value="once">Once</option></select></label>
            <label><span>Duration <span className="task-info" title="The period over which this task goal is expected to be reached.">i</span></span><select value={draft.duration} onChange={(event) => set("duration", event.target.value)}><option value="daily">Daily</option>{draft.type === "repeating" && <option value="weekly">Weekly</option>}<option value="custom">Custom days</option></select></label>
            {draft.duration === "custom" && <label><span>Days</span><input type="number" min={1} max={31} value={draft.customDays} onChange={(event) => set("customDays", event.target.value)} /></label>}
            <label><span>Start date</span><input type="date" value={draft.startDate} onChange={(event) => set("startDate", event.target.value)} /></label>
          </div>
          <div className="task-time-heading">Time amount <span className="task-info" title="The amount of time set to be assigned to this task during the selected goal period.">i</span></div>
          <div className="task-time-grid">{draft.duration !== "daily" && <label><span>Days</span><input type="number" min={0} max={periodDaysForDraft(draft)} value={draft.amountDays} onChange={(event) => set("amountDays", event.target.value)} /></label>}{(["amountHours", "amountMinutes", "amountSeconds"] as const).map((key, index) => <label key={key}><span>{["Hours", "Minutes", "Seconds"][index]}</span><input type="number" min={0} max={index === 0 ? 23 : 59} value={draft[key]} onChange={(event) => set(key, event.target.value)} /></label>)}</div>
          </div>
          <div className="task-goal-section"><div className="task-goal-section-title">Preset time <span className="task-info" title="The initial timer/counter goal used when this task is selected.">i</span></div><div className="task-time-grid">{(["presetHours", "presetMinutes", "presetSeconds"] as const).map((key, index) => <label key={key}><span>{["Hours", "Minutes", "Seconds"][index]}</span><input type="number" min={0} max={index === 0 ? 23 : 59} value={draft[key]} onChange={(event) => set(key, event.target.value)} /></label>)}</div></div>
          {error && <div className="task-form-error">{error}</div>}
          <div className="task-form-actions"><button type="button" className="btn btn-secondary btn-small" onClick={closeEditor}>Cancel</button><button type="submit" className="btn btn-primary btn-small">Save task</button></div>
        </form>
      )}
      {visibleTasks.length === 0 ? <div className="task-empty">No tasks match your search.</div> : <div className="task-group"><span className="task-group-label">{showArchived ? "Archived" : "Tasks"}</span><ul className="task-list">{visibleTasks.map((task) => <li key={task.id} className="task-list-row"><button type="button" className={task.id === selectedTaskId ? "task-item selected" : "task-item"} onClick={() => onSelectTask(task.id)}><span className="task-item-name">{task.pinned && <span className="task-star">★</span>}{task.name}</span><span className="task-item-goal">{task.goal ? `${task.goal.duration === "custom" ? `${task.goal.customDays}d` : task.goal.duration} · ${formatDuration(task.goal.amountMs)}` : "No goal"}</span></button><div className="task-row-actions"><button type="button" className="task-menu-trigger" onClick={() => setOpenActionsId(openActionsId === task.id ? null : task.id)} aria-label={`Actions for ${task.name}`}>⋯</button>{openActionsId === task.id && <div className="task-action-menu">{!task.archived && <button type="button" className="task-row-action" onClick={() => openEditor(task)}>Edit</button>}<button type="button" className="task-row-action" onClick={() => onUpdateTask(task.id, { pinned: !task.pinned })}>{task.pinned ? "Unpin" : "Pin"}</button><button type="button" className="task-row-action" onClick={() => onUpdateTask(task.id, { archived: !task.archived })}>{task.archived ? "Restore" : "Archive"}</button><button type="button" className="task-row-action danger" onClick={() => onDeleteTask(task.id)}>Delete</button></div>}</div></li>)}</ul></div>}
    </section>
  );
}
