interface Tab {
  id: string;
  label: string;
}

interface SectionTabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export function SectionTabs({ tabs, active, onChange }: SectionTabsProps) {
  return (
    <div className="flex gap-0 border-b border-border mb-8 overflow-x-auto scrollbar-none">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`shrink-0 pb-3 px-1 mr-7 font-body text-sm transition-colors border-b-2 -mb-px ${
            active === tab.id
              ? "border-primary text-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
