import { useMemo, useState, type FormEvent } from "react";
import type { Task } from "../types";

interface TaskViewProps {
  tasks: Task[];
  selectedTaskId: string;
  onSelectTask: (taskId: string) => void;
  onAddTask: (name: string) => void;
}

export function TaskView({ tasks, selectedTaskId, onSelectTask, onAddTask }: TaskViewProps) {
  const [query, setQuery] = useState("");
  const [draftName, setDraftName] = useState("");
  const [showForm, setShowForm] = useState(false);

  const visibleTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (task.archived) return false;
      if (!normalized) return true;
      return task.name.toLowerCase().includes(normalized);
    });
  }, [query, tasks]);

  const pinnedTasks = visibleTasks.filter((task) => task.pinned);
  const otherTasks = visibleTasks.filter((task) => !task.pinned);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draftName.trim();
    if (!trimmed) return;
    onAddTask(trimmed);
    setDraftName("");
    setShowForm(false);
  };

  return (
    <section className="glass-card tasks-view">
      <div className="tasks-header">
        <h2>Tasks</h2>
        <button type="button" className="task-add-trigger" onClick={() => setShowForm((open) => !open)}>
          {showForm ? "Close" : "+ Add Task"}
        </button>
      </div>

      <label className="task-search" htmlFor="task-search">
        <span className="task-search-label">Search tasks</span>
        <input
          id="task-search"
          type="text"
          placeholder="Search tasks..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {showForm && (
        <form className="task-form" onSubmit={handleSubmit}>
          <input
            type="text"
            autoFocus
            value={draftName}
            maxLength={60}
            placeholder="Task name"
            onChange={(event) => setDraftName(event.target.value)}
          />
          <div className="task-form-actions">
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-small">
              Save
            </button>
          </div>
        </form>
      )}

      {visibleTasks.length === 0 ? (
        <div className="task-empty">No tasks match your search.</div>
      ) : (
        <>
          {pinnedTasks.length > 0 && (
            <div className="task-group">
              <span className="task-group-label">Pinned</span>
              <ul className="task-list">
                {pinnedTasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      className={task.id === selectedTaskId ? "task-item selected" : "task-item"}
                      onClick={() => onSelectTask(task.id)}
                    >
                      <span className="task-item-name">
                        <span className="task-star" aria-hidden="true">
                          ★
                        </span>
                        {task.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {otherTasks.length > 0 && (
            <div className="task-group">
              <span className="task-group-label">Other</span>
              <ul className="task-list">
                {otherTasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      className={task.id === selectedTaskId ? "task-item selected" : "task-item"}
                      onClick={() => onSelectTask(task.id)}
                    >
                      <span className="task-item-name">{task.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
