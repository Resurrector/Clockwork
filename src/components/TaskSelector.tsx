import { useEffect, useRef, useState } from "react";
import type { Task } from "../types";

interface TaskSelectorProps {
  tasks: Task[];
  selectedTaskId: string;
  onSelectTask: (taskId: string) => void;
}

export function TaskSelector({
  tasks,
  selectedTaskId,
  onSelectTask,
}: TaskSelectorProps) {
  const visibleTasks = tasks.filter((task) => !task.archived);
  const sortedTasks = visibleTasks;

  const selectedTask =
    sortedTasks.find((task) => task.id === selectedTaskId) ?? sortedTasks[0] ?? null;
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: PointerEvent) => {
      if (!selectorRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [isOpen]);

  return (
    <div className="task-selector meta-row">
      <span className="meta-label">Current task</span>
      <div className="task-selector-control" ref={selectorRef}>
        <button
          type="button"
          className="task-selector-trigger"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          disabled={sortedTasks.length === 0}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span>{selectedTask?.name ?? "No task selected"}</span>
          <span className="task-selector-caret" aria-hidden="true">
            <svg viewBox="0 0 12 8"><path d="m1 1 5 5 5-5" /></svg>
          </span>
        </button>
        {isOpen && sortedTasks.length > 0 && (
          <div className="task-selector-menu" role="listbox" aria-label="Select task">
            {sortedTasks.map((task) => (
              <button
                type="button"
                role="option"
                aria-selected={task.id === selectedTask?.id}
                className={task.id === selectedTask?.id ? "task-selector-option selected" : "task-selector-option"}
                key={task.id}
                onClick={() => {
                  onSelectTask(task.id);
                  setIsOpen(false);
                }}
              >
                <span>{task.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
