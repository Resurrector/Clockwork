import type { AppView } from "../types";

interface AppNavigationProps {
  activeView: AppView;
  onChange: (view: AppView) => void;
}

const tabs: { value: AppView; label: string; icon: string }[] = [
  { value: "timer", label: "Timer", icon: "M12 2a10 10 0 1 0 10 10M12 6v6l4 2" },
  { value: "tasks", label: "Tasks", icon: "M5 5h14v14H5zM8 9h8M8 13h8M8 17h5" },
  { value: "history", label: "History", icon: "M4 12a8 8 0 1 0 2.34-5.66M4 4v5h5M12 8v4l3 2" },
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
            <svg className="nav-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d={tab.icon} />
            </svg>
            <span className="nav-btn-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
