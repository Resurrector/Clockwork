import type { AppView } from "../types";

interface AppNavigationProps {
  activeView: AppView;
  onChange: (view: AppView) => void;
}

const tabs: { value: AppView; label: string; icon: string }[] = [
  { value: "timer", label: "Timer", icon: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" },
  { value: "tasks", label: "Tasks", icon: "M4 5.5h16M4 12h16M4 18.5h16M7 5.5h.01M7 12h.01M7 18.5h.01" },
  { value: "history", label: "History", icon: "M4 4v5h5M4.8 14a8 8 0 1 0 1.7-8.1L4 9M12 8v4l2.5 2" },
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
