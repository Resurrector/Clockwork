import type { Task } from "../types";

interface TaskSelectorProps {
  tasks: Task[];
  selectedTaskId: string;
  onSelectTask: (taskId: string) => void;
}

export function TaskSelector({ tasks, selectedTaskId, onSelectTask }: TaskSelectorProps) {
  const visibleTasks = tasks.filter((task) => !task.archived);
  const sortedTasks = [...visibleTasks].sort((left, right) => {
    if (left.pinned !== right.pinned) return Number(right.pinned) - Number(left.pinned);
    return left.name.localeCompare(right.name);
  });

  const selectedTask =
    sortedTasks.find((task) => task.id === selectedTaskId) ?? sortedTasks[0] ?? null;

  return (
    <section className="task-selector glass-card">
      <label className="task-selector-label" htmlFor="task-selector">
        Task
      </label>
      <div className="task-selector-control">
        <select
          id="task-selector"
          aria-label="Select task"
          value={selectedTask?.id ?? ""}
          onChange={(event) => onSelectTask(event.target.value)}
          disabled={sortedTasks.length === 0}
        >
          {sortedTasks.length === 0 ? (
            <option value="">No tasks available</option>
          ) : (
            sortedTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))
          )}
        </select>
        <span className="task-selector-caret" aria-hidden="true">
          ▾
        </span>
      </div>
    </section>
  );
}
