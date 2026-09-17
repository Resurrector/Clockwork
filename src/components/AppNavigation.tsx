import type { AppView } from "../types";

interface AppNavigationProps {
  activeView: AppView;
  onChange: (view: AppView) => void;
}

const tabs: { value: AppView; label: string }[] = [
  { value: "timer", label: "Timer" },
  { value: "tasks", label: "Tasks" },
  { value: "history", label: "History" },
];

export function AppNavigation({ activeView, onChange }: AppNavigationProps) {
  return (
    <nav className="app-nav" aria-label="Main navigation">
      {tabs.map((tab) => {
        const isActive = tab.value === activeView;
        return (
          <button
            key={tab.value}
            type="button"
            className={isActive ? "nav-btn active" : "nav-btn"}
            aria-pressed={isActive}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
