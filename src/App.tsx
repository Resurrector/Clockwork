import "./App.css";
import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { useTimer } from "./hooks/useCountdown";
import { formatDuration } from "./lib/time";
import { playCompletionAlarm } from "./lib/alarm";
import { WheelPicker } from "./components/WheelPicker";
import { PresetManager } from "./components/PresetManager";
import { AppNavigation } from "./components/AppNavigation";
import { TaskSelector } from "./components/TaskSelector";
import { TaskView } from "./components/TaskView";
import { loadTasks, saveTasks } from "./lib/tasks";
import type { AppView, Task, TimerMode } from "./types";

const RING_RADIUS = 80;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const WINDOW_STATE_KEY = "clockwork-window-state";
const MIN_WINDOW_WIDTH = 456;
const MIN_WINDOW_HEIGHT = 640;
const showSidebar = import.meta.env.VITE_SHOW_SIDEBAR !== "false";
const showTaskSelector = import.meta.env.VITE_SHOW_TASK_SELECTOR !== "false";

const mockHistory = [
  { day: "Today", task: "Deep Work", duration: "1h 20m", total: "5h 45m" },
  { day: "Yesterday", task: "Programming", duration: "2h 10m", total: "4h 40m" },
  { day: "Mon", task: "Study", duration: "55m", total: "3h 25m" },
  { day: "Sun", task: "Reading", duration: "40m", total: "2h 50m" },
];

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
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selection, setSelection] = useState<"20s" | "2m" | "custom">("20s");
  const [customMinutes, setCustomMinutes] = useState(1);
  const [customSeconds, setCustomSeconds] = useState(0);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

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

  const customAmountMs = customMinutes * 60_000 + customSeconds * 1000;
  const adjustmentMs =
    selection === "20s" ? 20_000 : selection === "2m" ? 120_000 : customAmountMs;

  const handleAdjust = (direction: 1 | -1) => adjust(direction * adjustmentMs);

  const handleStartPauseResume = () => {
    if (status === "idle" || status === "finished") start();
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
              CW
            </button>
            <div>
              <div className="brand-name">ClockWork</div>
              <div className="brand-subtitle">Focus</div>
            </div>
          </div>

          <AppNavigation activeView={activeView} onChange={setActiveView} />

          <div className="sidebar-summary">
            <div className="summary-label">Today</div>
            <div className="summary-value">3h 20m</div>
            <div className="summary-meta">+32% vs. yesterday</div>
          </div>

          <div className="sidebar-footer">
            <div className="footer-label">Focus streak</div>
            <div className="footer-value">12 days</div>
          </div>
          </aside>
        )}

        <div className="workspace">
          {activeView === "timer" && (
            <div className="screen timer-screen">
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
            <div className="screen tasks-screen">
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
            <div className="screen history-screen">
              <header className="screen-header">
                <div>
                  <p className="eyebrow">Insights</p>
                  <h1>History</h1>
                </div>
              </header>

              <div className="history-grid">
                <div className="summary-card glass-card">
                  <span className="field-label">This week</span>
                  <strong>18h 30m</strong>
                  <small>Across 7 sessions</small>
                </div>
                <div className="summary-card glass-card">
                  <span className="field-label">Longest focus</span>
                  <strong>1h 42m</strong>
                  <small>Deep Work</small>
                </div>
                <div className="summary-card glass-card">
                  <span className="field-label">Most active day</span>
                  <strong>Tuesday</strong>
                  <small>6h 15m</small>
                </div>
              </div>

              <section className="glass-card history-panel">
                <div className="history-panel-header">
                  <span className="field-label">Recent sessions</span>
                  <button type="button" className="link-button">
                    View all
                  </button>
                </div>

                <div className="history-list">
                  {mockHistory.map((entry) => (
                    <div className="history-row" key={`${entry.day}-${entry.task}`}>
                      <div className="history-day">{entry.day}</div>
                      <div className="history-task">{entry.task}</div>
                      <div className="history-duration">{entry.duration}</div>
                      <div className="history-total">{entry.total}</div>
                    </div>
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