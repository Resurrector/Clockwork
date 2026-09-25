import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
  type WheelEvent,
} from "react";
import type { Task, TaskGoal } from "../types";
import { formatDuration } from "../lib/time";

interface TaskViewProps {
  tasks: Task[];
  selectedTaskId: string;
  dismissSignal: number;
  sidebarExpanded: boolean;
  onSelectTask: (taskId: string) => void;
  onAddTask: (name: string) => void;
  onUpdateTask: (
    taskId: string,
    changes: Partial<Pick<Task, "name" | "goal" | "presetTimeMs" | "archived">>,
  ) => void;
  onDeleteTask: (taskId: string) => void;
  onReorderTasks: (taskIds: string[]) => void;
}

type Panel = "goal" | "preset" | null;
type Draft = {
  name: string;
  type: TaskGoal["type"];
  duration: TaskGoal["duration"];
  customDays: string;
  startDate: string;
  amountDays: string;
  amountHours: string;
  amountMinutes: string;
  amountSeconds: string;
  presetHours: string;
  presetMinutes: string;
  presetSeconds: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const fromTask = (task?: Task): Draft => {
  const goal = task?.goal;
  const amount = goal?.amountMs ?? 0;
  const preset = task?.presetTimeMs ?? 0;
  return {
    name: task?.name ?? "",
    type: goal?.type ?? "repeating",
    duration: goal?.duration ?? "daily",
    customDays: String(goal?.customDays ?? 1),
    startDate: goal?.startDate ?? today(),
    amountDays: String(Math.floor(amount / 86_400_000)),
    amountHours: String(Math.floor((amount % 86_400_000) / 3_600_000)),
    amountMinutes: String(Math.floor((amount % 3_600_000) / 60_000)),
    amountSeconds: String(Math.floor((amount % 60_000) / 1000)),
    presetHours: String(Math.floor(preset / 3_600_000)),
    presetMinutes: String(Math.floor((preset % 3_600_000) / 60_000)),
    presetSeconds: String(Math.floor((preset % 60_000) / 1000)),
  };
};
const periodDays = (draft: Draft) =>
  draft.duration === "daily"
    ? 1
    : draft.duration === "weekly"
      ? 7
      : Math.max(1, Number(draft.customDays) || 1);
const parseClock = (h: string, m: string, s: string) => {
  const values = [Number(h), Number(m), Number(s)];
  if (
    !values.every(Number.isInteger) ||
    values[0] < 0 ||
    values[0] > 23 ||
    values[1] < 0 ||
    values[1] > 59 ||
    values[2] < 0 ||
    values[2] > 59
  )
    return null;
  return values[0] * 3_600_000 + values[1] * 60_000 + values[2] * 1000;
};
const dueDate = (goal: TaskGoal) => {
  const days =
    goal.duration === "daily"
      ? 1
      : goal.duration === "weekly"
        ? 7
        : (goal.customDays ?? 1);
  const date = new Date(`${goal.startDate}T00:00:00`);
  date.setDate(date.getDate() + days - 1);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const Icon = ({ type }: { type: "archive" | "more" }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d={
        type === "archive"
          ? "M4 7h16v13H4zM3 4h18v3H3zM9 11h6"
          : "M5 12h.01M12 12h.01M19 12h.01"
      }
    />
  </svg>
);

export function TaskView({
  tasks,
  selectedTaskId,
  dismissSignal,
  sidebarExpanded,
  onSelectTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onReorderTasks,
}: TaskViewProps) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [panelTaskId, setPanelTaskId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [draft, setDraft] = useState<Draft>(fromTask());
  const [error, setError] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const visibleTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.archived === showArchived &&
          task.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query, showArchived, tasks],
  );

  useEffect(() => {
    setOpenActionsId(null);
    setEditingId(null);
    setAdding(false);
    setDeleteId(null);
    setPanel(null);
    setPanelTaskId(null);
  }, [dismissSignal]);

  useEffect(() => {
    if (!openActionsId) return;
    const close = () => setOpenActionsId(null);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openActionsId]);

  const closeSettings = () => {
    setPanel(null);
    setPanelTaskId(null);
    setError("");
  };
  const set = (key: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const beginRename = (task: Task) => {
    setOpenActionsId(null);
    setDeleteId(null);
    setEditingId(task.id);
    setDraft(fromTask(task));
  };
  const beginAdd = () => {
    setOpenActionsId(null);
    setDeleteId(null);
    setAdding(true);
    setEditingId(null);
    setDraft(fromTask());
    setError("");
  };
  const openPanel = (next: Panel, task: Task) => {
    setOpenActionsId(null);
    setDeleteId(null);
    setEditingId(null);
    setPanelTaskId(task.id);
    setDraft(fromTask(task));
    setPanel(next);
    setError("");
  };
  const scrollNumber = (event: WheelEvent<HTMLInputElement>) => {
    event.preventDefault();
    const input = event.currentTarget;
    const min = Number(input.min || 0);
    const max = Number(input.max || 999);
    const next = Number(input.value || 0) + (event.deltaY < 0 ? 1 : -1);
    input.value = String(next < min ? max : next > max ? min : next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const saveName = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      setError("Enter a task name.");
      return;
    }
    if (adding) onAddTask(draft.name.trim());
    else if (editingId) onUpdateTask(editingId, { name: draft.name.trim() });
    setAdding(false);
    setEditingId(null);
    setError("");
  };
  const saveGoal = (event: FormEvent) => {
    event.preventDefault();
    const days = Number(draft.customDays);
    const amountDays = Number(draft.amountDays);
    const clock = parseClock(
      draft.amountHours,
      draft.amountMinutes,
      draft.amountSeconds,
    );
    const total = clock === null ? null : clock + amountDays * 86_400_000;
    const limit = periodDays(draft) * 86_400_000;
    if (
      !panelTaskId ||
      !draft.startDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(draft.startDate) ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 31 ||
      !Number.isInteger(amountDays) ||
      amountDays < 0 ||
      total === null ||
      total <= 0 ||
      total > limit
    ) {
      setError("Enter a valid goal amount within the selected period.");
      return;
    }
    const goal: TaskGoal = {
      type: draft.type,
      duration: draft.duration,
      ...(draft.duration === "custom" ? { customDays: days } : {}),
      startDate: draft.startDate,
      amountMs: total,
    };
    onUpdateTask(panelTaskId, { goal });
    closeSettings();
  };
  const savePreset = (event: FormEvent) => {
    event.preventDefault();
    if (!panelTaskId) return;
    const value = parseClock(
      draft.presetHours,
      draft.presetMinutes,
      draft.presetSeconds,
    );
    if (value === null) {
      setError("Enter a valid preset time.");
      return;
    }
    onUpdateTask(panelTaskId, { presetTimeMs: value > 0 ? value : undefined });
    closeSettings();
  };
  const renderClock = (prefix: "amount" | "preset", includeDays: boolean) => (
    <div
      className={
        includeDays ? "task-time-inputs with-days" : "task-time-inputs"
      }
    >
      {includeDays && (
        <label>
          <span>Days</span>
          <input
            type="number"
            min={0}
            max={periodDays(draft)}
            value={draft.amountDays}
            onWheel={scrollNumber}
            onChange={(e) => set("amountDays", e.target.value)}
          />
        </label>
      )}
      {(["Hours", "Minutes", "Seconds"] as const).map((label, index) => {
        const key = `${prefix}${label}` as keyof Draft;
        return (
          <label key={key}>
            <span>{label}</span>
            <input
              type="number"
              min={0}
              max={index === 0 ? 23 : 59}
              value={draft[key] as string}
              onWheel={scrollNumber}
              onChange={(e) => set(key, e.target.value)}
            />
          </label>
        );
      })}
    </div>
  );
  const renderPanel = () =>
    panel && (
      <div
        className="task-settings-panel task-settings-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <form onSubmit={panel === "goal" ? saveGoal : savePreset}>
          <div className="task-settings-heading">
            <div>
              <span className="field-label">Task settings</span>
              <h3>{panel === "goal" ? "Task goal" : "Preset time"}</h3>
            </div>
            <button
              type="button"
              className="task-settings-close"
              onClick={closeSettings}
            >
              ×
            </button>
          </div>
          {panel === "goal" && (
            <>
              <div className="task-goal-grid">
                <label>
                  <span>Type</span>
                  <select
                    value={draft.type}
                    onChange={(e) => {
                      const type = e.target.value as TaskGoal["type"];
                      setDraft((current) => ({
                        ...current,
                        type,
                        duration: type === "once" ? "custom" : current.duration,
                      }));
                    }}
                  >
                    <option value="repeating">Repeating</option>
                    <option value="once">Once</option>
                  </select>
                </label>
                <label>
                  <span>
                    Duration{" "}
                    <span
                      className="task-info"
                      title="The period over which this task goal is expected to be reached."
                    >
                      i
                    </span>
                  </span>
                  <select
                    value={draft.duration}
                    onChange={(e) => set("duration", e.target.value)}
                  >
                    <option value="daily">Daily</option>
                    {draft.type === "repeating" && (
                      <option value="weekly">Weekly</option>
                    )}
                    <option value="custom">Custom days</option>
                  </select>
                </label>
                {draft.duration === "custom" && (
                  <label>
                    <span>Days</span>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={draft.customDays}
                      onWheel={scrollNumber}
                      onChange={(e) => set("customDays", e.target.value)}
                    />
                  </label>
                )}
                <label>
                  <span>Start date</span>
                  <input
                    type="date"
                    value={draft.startDate || today()}
                    onChange={(e) => set("startDate", e.target.value)}
                  />
                </label>
              </div>
              <div className="task-time-heading">
                Time amount{" "}
                <span
                  className="task-info"
                  title="The amount of time set to be assigned to this task during the selected goal period."
                >
                  i
                </span>
              </div>
              {renderClock("amount", draft.duration !== "daily")}
            </>
          )}
          {panel === "preset" && <>{renderClock("preset", false)}</>}
          {error && <div className="task-form-error">{error}</div>}
          <div className="task-form-actions">
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={closeSettings}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-small">
              Save
            </button>
          </div>
        </form>
      </div>
    );
  const renderTask = (task: Task) => (
    <li
      key={task.id}
      className={
        draggedId === task.id ? "task-list-row dragging" : "task-list-row"
      }
      draggable={!editingId && !adding}
      onDragStart={(event: DragEvent<HTMLLIElement>) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
        setDraggedId(task.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={() => {
        if (draggedId && draggedId !== task.id) {
          const ids = tasks.map((item) => item.id);
          const from = ids.indexOf(draggedId);
          const to = ids.indexOf(task.id);
          ids.splice(from, 1);
          ids.splice(to, 0, draggedId);
          onReorderTasks(ids);
        }
        setDraggedId(null);
      }}
      onDragEnd={() => setDraggedId(null)}
    >
      {editingId === task.id ? (
        <form className="task-item task-edit-form" onSubmit={saveName}>
          <input
            autoFocus
            value={draft.name}
            maxLength={60}
            onChange={(e) => set("name", e.target.value)}
          />
          <button
            type="button"
            className="task-row-action"
            onClick={() => setEditingId(null)}
          >
            Cancel
          </button>
          <button type="submit" className="task-row-action primary">
            Save
          </button>
        </form>
      ) : (
        <div
          className={
            task.id === selectedTaskId ? "task-item selected" : "task-item"
          }
          onClick={() => onSelectTask(task.id)}
        >
          <span className="task-item-name">{task.name}</span>
          {task.goal && (
            <span className="task-item-goal">
              <span>{dueDate(task.goal)}</span>
              <span>{formatDuration(task.goal.amountMs)}</span>
              <span>
                {task.goal.duration === "custom"
                  ? `${task.goal.customDays}d`
                  : task.goal.duration}
              </span>
            </span>
          )}
          <div className="task-inline-actions">
            <button
              type="button"
              className="task-icon-button"
              aria-label={task.archived ? "Restore task" : "Archive task"}
              onClick={(e) => {
                e.stopPropagation();
                onUpdateTask(task.id, { archived: !task.archived });
              }}
            >
              <Icon type="archive" />
            </button>
            <div
              className="task-more-wrap"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="task-icon-button task-more-button"
                aria-label="More task actions"
                aria-expanded={openActionsId === task.id}
                onClick={() =>
                  setOpenActionsId(openActionsId === task.id ? null : task.id)
                }
              >
                <Icon type="more" />
              </button>
              {openActionsId === task.id && (
                <div className="task-action-menu">
                  <button
                    type="button"
                    className="task-row-action"
                    onClick={() => beginRename(task)}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="task-row-action"
                    onClick={() => openPanel("goal", task)}
                  >
                    Goal
                  </button>
                  <button
                    type="button"
                    className="task-row-action"
                    onClick={() => openPanel("preset", task)}
                  >
                    Preset Time
                  </button>
                  {deleteId === task.id ? (
                    <div className="task-delete-inline">
                      <span>Delete?</span>
                      <button
                        type="button"
                        className="task-row-action danger"
                        onClick={() => onDeleteTask(task.id)}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        className="task-row-action"
                        onClick={() => setDeleteId(null)}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="task-row-action danger"
                      onClick={() => setDeleteId(task.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  );

  return (
    <section className="glass-card tasks-view">
      <div className="tasks-header">
        <h2>Tasks</h2>
        <button type="button" className="task-add-trigger" onClick={beginAdd}>
          + Add Task
        </button>
        <button
          type="button"
          className="task-archive-toggle"
          onClick={() => setShowArchived((value) => !value)}
        >
          {showArchived ? "Active tasks" : "Archived"}
        </button>
      </div>
      <label className="task-search" htmlFor="task-search">
        <span className="task-search-label">Search tasks</span>
        <input
          id="task-search"
          type="text"
          placeholder="Search tasks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {(adding || visibleTasks.length > 0) && (
        <div className="task-group">
          <span className="task-group-label">
            {showArchived ? "Archived" : "Tasks"}
          </span>
          <ul className="task-list">
            {adding && (
              <li className="task-list-row">
                <form className="task-item task-edit-form" onSubmit={saveName}>
                  <input
                    autoFocus
                    value={draft.name}
                    maxLength={60}
                    placeholder="Task name"
                    onChange={(e) => set("name", e.target.value)}
                  />
                  <button
                    type="button"
                    className="task-row-action"
                    onClick={() => setAdding(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="task-row-action primary">
                    Save
                  </button>
                </form>
              </li>
            )}
            {visibleTasks.map(renderTask)}
          </ul>
        </div>
      )}
      {visibleTasks.length === 0 && !adding && (
        <div className="task-empty">No tasks match your search.</div>
      )}
      {panel && (
        <div
          className={
            sidebarExpanded
              ? "task-settings-backdrop sidebar-expanded"
              : "task-settings-backdrop"
          }
          onClick={closeSettings}
        >
          {renderPanel()}
        </div>
      )}
    </section>
  );
}
