import "./App.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { useTimer } from "./hooks/useCountdown";
import { formatDuration, formatHistoryDuration } from "./lib/time";
import { playCompletionAlarm } from "./lib/alarm";
import { WheelPicker } from "./components/WheelPicker";
import { PresetManager } from "./components/PresetManager";
import { AppNavigation } from "./components/AppNavigation";
import { TaskSelector } from "./components/TaskSelector";
import { TaskView } from "./components/TaskView";
import { loadTasks, saveTasks } from "./lib/tasks";
import { createSession, loadHistory, saveHistory } from "./lib/history";
import type { AppView, SessionRecord, Task, TimerMode } from "./types";

const RING_RADIUS = 80;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const WINDOW_STATE_KEY = "clockwork-window-state";
const MIN_WINDOW_WIDTH = 456;
const MIN_WINDOW_HEIGHT = 640;
const showSidebar = import.meta.env.VITE_SHOW_SIDEBAR !== "false";
const showTaskSelector = import.meta.env.VITE_SHOW_TASK_SELECTOR !== "false";

const recordTotalMs = (entry: SessionRecord) => entry.totalMs ?? entry.durationMs;
const recordCompensatedMs = (entry: SessionRecord) => entry.compensatedMs ?? entry.distractedMs ?? 0;
const recordActiveMs = (entry: SessionRecord) => entry.activeMs ?? 0;
const recordFocusedMs = (entry: SessionRecord) => entry.focusedMs ?? 0;
const normalizeTaskName = (name: string) => name.trim().toLocaleLowerCase();
const sessionDate = (entry: SessionRecord) =>
  new Date(entry.startedAt ?? entry.completedAt).toDateString();

function App() {
  const appWindow = getCurrentWindow();
  useEffect(() => {
    console.log("WINDOW LABEL:", appWindow.label);

    appWindow
      .isDecorated()
      .then((decorated) => console.log("IS DECORATED:", decorated));

    appWindow
      .isResizable()
      .then((resizable) => console.log("IS RESIZABLE:", resizable));
  }, []);

  const minimizeWindow = () => appWindow.minimize();
  const maximizeWindow = () => appWindow.toggleMaximize();
  const closeWindow = () => appWindow.close();

  useEffect(() => {
    let unlistenResize: (() => void) | undefined;
    let unlistenMove: (() => void) | undefined;

    const restoreWindowState = async () => {
      const stored = localStorage.getItem(WINDOW_STATE_KEY);
      if (stored) {
        try {
          const state = JSON.parse(stored) as {
            size?: { width: number; height: number };
            position?: { x: number; y: number };
          };
          if (state.size) {
            await appWindow.setSize(
              new PhysicalSize(
                Math.max(MIN_WINDOW_WIDTH, state.size.width),
                Math.max(MIN_WINDOW_HEIGHT, state.size.height),
              ),
            );
          }
          if (state.position) {
            await appWindow.setPosition(
              new PhysicalPosition(
                state.position.x,
                state.position.y,
              ),
            );
          }
        } catch {
          localStorage.removeItem(WINDOW_STATE_KEY);
        }
      }

      const saveWindowState = async () => {
        const size = await appWindow.innerSize();
        const position = await appWindow.outerPosition();
        localStorage.setItem(
          WINDOW_STATE_KEY,
          JSON.stringify({ size, position }),
        );
      };

      unlistenResize = await appWindow.onResized(saveWindowState);
      unlistenMove = await appWindow.onMoved(saveWindowState);
    };

    void restoreWindowState().catch((error) => {
      console.error("Unable to restore window state.", error);
    });
    return () => {
      unlistenResize?.();
      unlistenMove?.();
    };
  }, [appWindow]);

  const {
    mode,
    status,
    remainingMs,
    durationMs,
    elapsedMs,
    activeElapsedMs,
    startedAtMs,
    endedAtMs,
    start,
    pause,
    resume,
    reset,
    adjust,
    load,
    setMode,
  } = useTimer();

  const [activeView, setActiveView] = useState<AppView>("timer");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [history, setHistory] = useState<SessionRecord[]>(() => loadHistory());
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selection, setSelection] = useState<"20s" | "2m" | "custom">("20s");
  const [customMinutes, setCustomMinutes] = useState(1);
  const [customSeconds, setCustomSeconds] = useState(0);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [editingHistoryName, setEditingHistoryName] = useState("");
  const sessionRef = useRef<{
    taskId: string;
    taskName: string;
    mode: TimerMode;
    compensatedMs: number;
  } | null>(null);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const previousStatusRef = useRef(status);
  useEffect(() => {
    if (status === "finished" && previousStatusRef.current !== "finished") {
      const session = sessionRef.current;
      const endedAt = endedAtMs ?? Date.now();
      const startedAt = startedAtMs;
      const compensatedMs = session?.compensatedMs ?? 0;
      const activeMs = Math.max(0, activeElapsedMs);
      if (startedAt !== null && endedAt >= startedAt) {
        const totalMs = endedAt - startedAt;
        if (totalMs <= 0 && activeMs <= 0) {
          sessionRef.current = null;
          previousStatusRef.current = status;
          return;
        }
        setHistory((previous) => [
          createSession(
            session?.taskId ?? selectedTaskId,
            session?.taskName ?? tasks.find((candidate) => candidate.id === selectedTaskId)?.name ?? "Unassigned",
            totalMs,
            session?.mode ?? mode,
            {
              totalMs,
              activeMs,
              compensatedMs,
              distractedMs: compensatedMs,
              focusedMs: Math.max(0, activeMs - compensatedMs),
              startedAt: new Date(startedAt).toISOString(),
              endedAt: new Date(endedAt).toISOString(),
            },
          ),
          ...previous,
        ]);
      }
      sessionRef.current = null;
    }
    previousStatusRef.current = status;
  }, [activeElapsedMs, elapsedMs, endedAtMs, mode, selectedTaskId, startedAtMs, status, tasks]);

  const today = new Date().toDateString();
  const todayHistory = history.filter((entry) => sessionDate(entry) === today);
  const todayTotalMs = todayHistory.reduce((total, entry) => total + recordFocusedMs(entry), 0);
  const todayTaskSummaries = useMemo(() => {
    const summaries = new Map<string, { name: string; focusedMs: number; sessions: number }>();
    for (const entry of todayHistory) {
      const key = normalizeTaskName(entry.taskName);
      const current = summaries.get(key);
      if (current) {
        current.focusedMs += recordFocusedMs(entry);
        current.sessions += 1;
      } else {
        summaries.set(key, { name: entry.taskName.trim(), focusedMs: recordFocusedMs(entry), sessions: 1 });
      }
    }
    return [...summaries.values()].sort((left, right) => right.focusedMs - left.focusedMs);
  }, [todayHistory]);
  const groupedHistory = useMemo(() => {
    const groups: Array<{ date: string; entries: SessionRecord[] }> = [];
    const groupsByDate = new Map<string, { date: string; entries: SessionRecord[] }>();
    for (const entry of history.slice(0, 20)) {
      const date = sessionDate(entry);
      const current = groupsByDate.get(date);
      if (current) {
        current.entries.push(entry);
      } else {
        const group = { date, entries: [entry] };
        groupsByDate.set(date, group);
        groups.push(group);
      }
    }
    return groups;
  }, [history]);
  useEffect(() => {
    if (tasks.length === 0) {
      setSelectedTaskId("");
      return;
    }

    const nextTask =
      tasks.find((task) => task.id === selectedTaskId && !task.archived) ??
      tasks.find((task) => !task.archived) ??
      tasks[0];

    if (!nextTask || nextTask.id !== selectedTaskId) {
      setSelectedTaskId(nextTask.id);
    }
  }, [selectedTaskId, tasks]);

  const handleAddTask = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const nextTask: Task = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `task_${Date.now().toString(36)}`,
      name: trimmed,
      pinned: false,
      archived: false,
      createdAt: new Date().toISOString(),
    };

    setTasks((previous) => [nextTask, ...previous]);
    setSelectedTaskId(nextTask.id);
  };

  const handleUpdateTask = (
    taskId: string,
    changes: Partial<Pick<Task, "name" | "pinned" | "archived">>,
  ) => {
    setTasks((previous) =>
      previous.map((task) => (task.id === taskId ? { ...task, ...changes } : task)),
    );
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((previous) => previous.filter((task) => task.id !== taskId));
  };

  const startHistoryEdit = (entry: SessionRecord) => {
    setEditingHistoryId(entry.id);
    setEditingHistoryName(entry.taskName);
  };

  const saveHistoryEdit = (entryId: string) => {
    const taskName = editingHistoryName.trim();
    if (!taskName) return;
    setHistory((previous) =>
      previous.map((entry) => (entry.id === entryId ? { ...entry, taskName } : entry)),
    );
    setEditingHistoryId(null);
    setEditingHistoryName("");
  };

  const deleteHistoryEntry = (entry: SessionRecord) => {
    if (!window.confirm(`Delete the session for "${entry.taskName}"?`)) return;
    setHistory((previous) => previous.filter((candidate) => candidate.id !== entry.id));
    if (editingHistoryId === entry.id) {
      setEditingHistoryId(null);
      setEditingHistoryName("");
    }
  };

  const customAmountMs = customMinutes * 60_000 + customSeconds * 1000;
  const adjustmentMs =
    selection === "20s" ? 20_000 : selection === "2m" ? 120_000 : customAmountMs;

  const handleAdjust = (direction: 1 | -1) => {
    const deltaMs = direction * adjustmentMs;
    adjust(deltaMs);
    const isCompensatedAdjustment =
      status === "running" &&
      ((mode === "countdown" && deltaMs > 0) ||
        (mode === "counter" && deltaMs < 0));
    if (isCompensatedAdjustment) {
      const compensatedMs = Math.abs(deltaMs);
      if (sessionRef.current) {
        sessionRef.current.compensatedMs += compensatedMs;
      }
    }
  };

  const handleStartPauseResume = () => {
    if (status === "idle" || status === "finished") {
      const task = tasks.find((candidate) => candidate.id === selectedTaskId);
      sessionRef.current = {
        taskId: selectedTaskId,
        taskName: task?.name ?? "Unassigned",
        mode,
        compensatedMs: 0,
      };
      start();
    }
    else if (status === "running") pause();
    else resume();
  };

  const primaryLabel =
    status === "running" ? "Pause" : status === "paused" ? "Resume" : "Start";

  const displayMs = mode === "countdown" ? remainingMs : elapsedMs;
  const ringProgress =
    mode === "countdown"
      ? durationMs > 0
        ? Math.min(1, Math.max(0, 1 - remainingMs / durationMs))
        : 0
      : durationMs > 0
        ? Math.min(1, Math.max(0, 1 - elapsedMs / durationMs))
        : 1;

  const handleModeChange = (nextMode: TimerMode) => {
    if (status === "running") return;
    setMode(nextMode);
  };

  const alarmPlayedAtRef = useRef(0);
  useEffect(() => {
    if (status !== "finished") return;
    const now = Date.now();
    if (now - alarmPlayedAtRef.current < 10_000) return;
    alarmPlayedAtRef.current = now;
    playCompletionAlarm();
  }, [status]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          target.closest("input, textarea, select, button, .wheel-rows"))
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) handleStartPauseResume();
      } else if (e.key === "r" || e.key === "R") {
        if (!e.repeat && status !== "idle") reset();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <main className="app">
      <header className="app-header" data-tauri-drag-region>
        <div className="titlebar-drag-region">
          <svg className="titlebar-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 8V12L14.5 14.5" stroke="#96c2ffcc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 3.33782C8.47087 2.48697 10.1786 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 10.1786 2.48697 8.47087 3.33782 7" stroke="#96c2ffcc" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="titlebar-title">ClockWork</span>
        </div>

        <div className="titlebar-controls">
          <button className="titlebar-button" onClick={minimizeWindow} aria-label="Minimize">
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M1 5h8" />
            </svg>
          </button>

          <button className="titlebar-button" onClick={maximizeWindow} aria-label="Maximize">
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <rect x="1.5" y="1.5" width="7" height="7" />
            </svg>
          </button>

          <button className="titlebar-button close" onClick={closeWindow} aria-label="Close">
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5" />
            </svg>
          </button>
        </div>
      </header>

      <div className="app-shell">
        {showSidebar && (
          <aside className={isSidebarExpanded ? "sidebar expanded" : "sidebar collapsed"}>
          <div className="sidebar-brand">
            <button
              type="button"
              className="brand-mark"
              onClick={() => setIsSidebarExpanded((expanded) => !expanded)}
              aria-label={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
              aria-expanded={isSidebarExpanded}
            >
              {isSidebarExpanded ? "CW" : (
                <svg className="sidebar-toggle-icon" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M3 5h14M3 10h14M3 15h14" />
                </svg>
              )}
            </button>
            <div>
              <div className="brand-name">ClockWork</div>
              <div className="brand-subtitle">Focus</div>
            </div>
          </div>

          <AppNavigation activeView={activeView} onChange={setActiveView} />

          <div className="sidebar-summary">
            <div className="summary-label">Today</div>
            <div className="summary-value">{formatHistoryDuration(todayTotalMs)}</div>
            <div className="summary-meta">{todayHistory.length} completed session{todayHistory.length === 1 ? "" : "s"}</div>
          </div>

          <div className="sidebar-footer">
            <div className="footer-label">Focus streak</div>
            <div className="footer-value">{new Set(history.map((entry) => entry.completedAt.slice(0, 10))).size} days</div>
          </div>
          </aside>
        )}

        <div className="workspace">
          {activeView === "timer" && (
            <div className="screen timer-screen" key="timer">
              <header className="screen-header">
                <div>
                  <p className="eyebrow">Focus session</p>
                  <h1>Timer</h1>
                </div>
              </header>

              <div className="timer-stage glass-card">
                <div className="timer-display-wrap">
                  <div
                    className={
                      status === "running"
                        ? "timer-display running"
                        : status === "finished"
                          ? "timer-display finished"
                          : "timer-display"
                    }
                  >
                    <svg className="timer-ring" viewBox="0 0 180 180" aria-hidden="true">
                      <circle className="timer-ring-track" cx="90" cy="90" r={RING_RADIUS} />
                      <circle
                        className="timer-ring-progress"
                        cx="90"
                        cy="90"
                        r={RING_RADIUS}
                        strokeDasharray={RING_CIRCUMFERENCE}
                        strokeDashoffset={RING_CIRCUMFERENCE * ringProgress}
                      />
                    </svg>
                    <span className="timer-time">{formatDuration(displayMs)}</span>
                  </div>

                  <div className="timer-metadata">
                    <div className="timer-metadata-mode">
                      <span className="field-label">Mode</span>
                      <div className="mode-toggle" role="tablist" aria-label="Timer mode">
                        <button
                          type="button"
                          className={mode === "countdown" ? "mode-toggle-btn active" : "mode-toggle-btn"}
                          onClick={() => handleModeChange("countdown")}
                          aria-pressed={mode === "countdown"}
                          disabled={status === "running"}
                        >
                          Timer
                        </button>
                        <button
                          type="button"
                          className={mode === "counter" ? "mode-toggle-btn active" : "mode-toggle-btn"}
                          onClick={() => handleModeChange("counter")}
                          aria-pressed={mode === "counter"}
                          disabled={status === "running"}
                        >
                          Counter
                        </button>
                      </div>
                    </div>
                    {showTaskSelector && (
                      <div className="timer-metadata-task">
                        <TaskSelector
                          tasks={tasks}
                          selectedTaskId={selectedTaskId}
                          onSelectTask={setSelectedTaskId}
                        />
                      </div>
                    )}
                    <div className="meta-row">
                      <span className="meta-label">Active time</span>
                      <span className="meta-value">{formatDuration(activeElapsedMs)}</span>
                    </div>
                  </div>
                </div>

                <div className="session-controls">
                  <button className="btn btn-secondary" onClick={reset} disabled={status === "idle"}>
                    Reset
                  </button>
                  <button
                    className={status === "running" ? "btn btn-primary running" : "btn btn-primary"}
                    onClick={handleStartPauseResume}
                  >
                    {primaryLabel}
                  </button>
                </div>
              </div>

              <section className="glass-card controls-card">
                <div className="adjust-row">
                  <div className="segment" role="radiogroup" aria-label="Adjustment amount">
                    <button
                      className={selection === "20s" ? "segment-btn selected" : "segment-btn"}
                      onClick={() => setSelection("20s")}
                    >
                      20 s
                    </button>
                    <button
                      className={selection === "2m" ? "segment-btn selected" : "segment-btn"}
                      onClick={() => setSelection("2m")}
                    >
                      2 min
                    </button>
                    <button
                      className={selection === "custom" ? "segment-btn selected" : "segment-btn"}
                      onClick={() => setSelection("custom")}
                    >
                      Custom
                    </button>
                  </div>

                  <div className="adjust-buttons">
                    <button className="btn-adjust" onClick={() => handleAdjust(-1)} aria-label="Subtract time">
                      −
                    </button>
                    <button className="btn-adjust" onClick={() => handleAdjust(1)} aria-label="Add time">
                      +
                    </button>
                  </div>
                </div>

                {selection === "custom" && (
                  <WheelPicker
                    minutes={customMinutes}
                    seconds={customSeconds}
                    onMinutesChange={setCustomMinutes}
                    onSecondsChange={setCustomSeconds}
                  />
                )}
              </section>

              <PresetManager onLoad={load} />
            </div>
          )}

          {activeView === "tasks" && (
            <div className="screen tasks-screen" key="tasks">
              <header className="screen-header">
                <div>
                  <p className="eyebrow">Workspace</p>
                  <h1>Tasks</h1>
                </div>
              </header>

              <TaskView
                tasks={tasks}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                onAddTask={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
              />
            </div>
          )}

          {activeView === "history" && (
            <div className="screen history-screen" key="history">
              <header className="screen-header">
                <div>
                  <p className="eyebrow">Insights</p>
                  <h1>History</h1>
                </div>
              </header>

              <section className="history-task-summary">
                <div className="history-section-label">Today's tasks</div>
                {todayTaskSummaries.length === 0 ? (
                  <div className="history-task-summary-empty">No completed tasks today.</div>
                ) : (
                  <div className="history-task-grid">
                    {todayTaskSummaries.map((task) => (
                      <div className="history-task-card glass-card" key={normalizeTaskName(task.name)}>
                        <span className="history-task-card-name">{task.name}</span>
                        <strong>{formatHistoryDuration(task.focusedMs)}</strong>
                        <small>{task.sessions} session{task.sessions === 1 ? "" : "s"}</small>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="glass-card history-panel">
                <div className="history-panel-header">
                  <span className="field-label">Recent sessions</span>
                  <span className="history-count">{history.length} total</span>
                </div>

                <div className="history-list">
                  {history.length === 0 ? (
                    <div className="history-placeholder">
                      <h2>No completed sessions yet</h2>
                      <p>Completed focus sessions will appear here.</p>
                    </div>
                  ) : groupedHistory.map((group) => (
                    <section className="history-day-group" key={group.date}>
                      <div className="history-day-divider">
                        <span>{new Date(group.entries[0].startedAt ?? group.entries[0].completedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                      </div>
                      <div className="history-day-list">
                        {group.entries.map((entry) => (
                          <details className="history-entry" key={entry.id}>
                            <summary className="history-row">
                              <div className="history-task">
                                {editingHistoryId === entry.id ? (
                                  <input
                                    className="history-task-edit"
                                    value={editingHistoryName}
                                    maxLength={60}
                                    onChange={(event) => setEditingHistoryName(event.target.value)}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      event.preventDefault();
                                    }}
                                    aria-label="History task name"
                                  />
                                ) : (
                                  <span>{entry.taskName}</span>
                                )}
                              </div>
                              <div className="history-duration" title="Focused time">
                                <span className="history-duration-label">Focused</span>
                                {formatHistoryDuration(recordFocusedMs(entry))}
                              </div>
                              <div className="history-total" title="Session start and end time">
                                {entry.startedAt ? new Date(entry.startedAt).toLocaleTimeString() : "—"} –{" "}
                                {entry.endedAt ? new Date(entry.endedAt).toLocaleTimeString() : "—"}
                              </div>
                            </summary>
                            <div className="history-actions" onClick={(event) => event.stopPropagation()}>
                              {editingHistoryId === entry.id ? (
                                <>
                                  <button type="button" className="history-action primary" onClick={() => saveHistoryEdit(entry.id)}>Save</button>
                                  <button type="button" className="history-action" onClick={() => setEditingHistoryId(null)}>Cancel</button>
                                </>
                              ) : (
                                <>
                                  <button type="button" className="history-action" onClick={() => startHistoryEdit(entry)}>Edit task</button>
                                  <button type="button" className="history-action danger" onClick={() => deleteHistoryEntry(entry)}>Delete</button>
                                </>
                              )}
                            </div>
                            <div className="history-details">
                              <span>Mode: {entry.mode === "countdown" ? "Countdown" : "Counter"}</span>
                              <span>Total: {formatHistoryDuration(recordTotalMs(entry))}</span>
                              <span>Active: {formatHistoryDuration(recordActiveMs(entry))}</span>
                              <span>Focused: {formatHistoryDuration(recordFocusedMs(entry))}</span>
                              <span>Compensated: {formatHistoryDuration(recordCompensatedMs(entry))}</span>
                              <span>
                                {entry.startedAt ? new Date(entry.startedAt).toLocaleTimeString() : "—"} –{" "}
                                {entry.endedAt ? new Date(entry.endedAt).toLocaleTimeString() : new Date(entry.completedAt).toLocaleTimeString()}
                              </span>
                            </div>
                          </details>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default App;