import "./App.css";
import { useEffect, useRef, useState } from "react";
import { useCountdown } from "./hooks/useCountdown";
import { formatDuration } from "./lib/time";
import { playCompletionAlarm } from "./lib/alarm";
import { WheelPicker } from "./components/WheelPicker";
import { PresetManager } from "./components/PresetManager";
import { AppNavigation } from "./components/AppNavigation";
import { TaskSelector } from "./components/TaskSelector";
import { TaskView } from "./components/TaskView";
import { loadTasks, saveTasks } from "./lib/tasks";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AppView, Task } from "./types";

const RING_RADIUS = 80;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

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
  const {
    status,
    remainingMs,
    durationMs,
    start,
    pause,
    resume,
    reset,
    adjust,
    load,
  } = useCountdown();

  const [activeView, setActiveView] = useState<AppView>("timer");
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
      id: crypto.randomUUID ? crypto.randomUUID() : `task_${Date.now().toString(36)}`,
      name: trimmed,
      pinned: false,
      archived: false,
      createdAt: new Date().toISOString(),
    };

    setTasks((previous) => [nextTask, ...previous]);
    setSelectedTaskId(nextTask.id);
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

  const statusText =
    status === "running"
      ? "Counting down"
      : status === "paused"
        ? "Paused"
        : status === "finished"
          ? "Finished"
          : "Ready";

  /** 0 = full time left (empty ring), 1 = time fully elapsed (full ring). */
  const ringProgress =
    durationMs > 0
      ? Math.min(1, Math.max(0, 1 - remainingMs / durationMs))
      : 0;

  // Completion alarm: plays exactly once each time a countdown finishes.
  // The ref guard makes StrictMode's double effect invocation (dev) and
  // any later re-renders while status stays "finished" harmless.
  const alarmPlayedAtRef = useRef(0);
  useEffect(() => {
    if (status !== "finished") return;
    const now = Date.now();
    if (now - alarmPlayedAtRef.current < 10_000) return;
    alarmPlayedAtRef.current = now;
    playCompletionAlarm();
  }, [status]);

  // Keyboard shortcuts: Space = Start/Pause/Resume, R = Reset.
  // Skipped while typing or when focus sits on a control that owns the key
  // (buttons, inputs, the wheel picker).
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
        // Prevent the page from scrolling before anything else.
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
          <svg
            className="titlebar-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 8V12L14.5 14.5" stroke="#96c2ffcc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M7 3.33782C8.47087 2.48697 10.1786 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 10.1786 2.48697 8.47087 3.33782 7" stroke="#96c2ffcc" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <span className="titlebar-title">ClockWork</span>
        </div>

        <div className="titlebar-controls">
          <button
            className="titlebar-button"
            onClick={minimizeWindow}
            aria-label="Minimize"
          >
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M1 5h8" />
            </svg>
          </button>

          <button
            className="titlebar-button"
            onClick={maximizeWindow}
            aria-label="Maximize"
          >
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <rect x="1.5" y="1.5" width="7" height="7" />
            </svg>
          </button>

          <button
            className="titlebar-button close"
            onClick={closeWindow}
            aria-label="Close"
          >
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5" />
            </svg>
          </button>
        </div>
      </header>

      <AppNavigation activeView={activeView} onChange={setActiveView} />

      <div className="app-content">
        {activeView === "timer" && (
          <>
            <TaskSelector
              tasks={tasks}
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
            />

            <section className="glass-card timer-card">
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
                <span className="timer-time">{formatDuration(remainingMs)}</span>
              </div>
              <span className="timer-status">{statusText}</span>
            </section>

            <section className="session-controls">
              <button className="btn btn-secondary" onClick={reset} disabled={status === "idle"}>
                Reset
              </button>
              <button
                className={status === "running" ? "btn btn-primary running" : "btn btn-primary"}
                onClick={handleStartPauseResume}
              >
                {primaryLabel}
              </button>
            </section>

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
          </>
        )}

        {activeView === "tasks" && (
          <TaskView
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
            onAddTask={handleAddTask}
          />
        )}

        {activeView === "history" && (
          <section className="glass-card history-placeholder">
            <h2>History</h2>
            <p>Session history and time summaries will be available in a future update.</p>
          </section>
        )}
      </div>
    </main>
  );
}


export default App;
