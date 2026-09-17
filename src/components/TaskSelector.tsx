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
  const sortedTasks = [...visibleTasks].sort((left, right) => {
    if (left.pinned !== right.pinned) return Number(right.pinned) - Number(left.pinned);
    return left.name.localeCompare(right.name);
  });

  const selectedTask =
    sortedTasks.find((task) => task.id === selectedTaskId) ?? sortedTasks[0] ?? null;

  return (
    <div className="task-selector meta-row">
      <label className="meta-label" htmlFor="task-selector">
        Current task
      </label>
      <div className="task-selector-control">
        <select
          id="task-selector"
          className="task-selector-select"
          aria-label="Select task"
          value={selectedTask?.id ?? ""}
          onChange={(event) => onSelectTask(event.target.value)}
          disabled={sortedTasks.length === 0}
        >
          {sortedTasks.length === 0 ? (
            <option value="">No task selected</option>
          ) : (
            sortedTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))
          )}
        </select>
        <span className="task-selector-caret" aria-hidden="true">
          <svg viewBox="0 0 12 8">
            <path d="m1 1 5 5 5-5" />
          </svg>
        </span>
      </div>
    </div>
  );
}
