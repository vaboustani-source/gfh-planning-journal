import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { PORTAL_NAV_GROUPS, PORTAL_TOP_ITEMS, type PortalNavItem } from "@/lib/portalNav";

const OPEN_KEY = "gfh.portal.navOpen";

function readOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function NavRow({ to, item, onClick, nested }: { to: string; item: PortalNavItem; onClick?: () => void; nested?: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg font-body text-sm transition-all duration-200 ${nested ? "px-3 py-2" : "px-4 py-2.5"} ${
          isActive ? "bg-sage/12 text-sage-dark font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
        }`
      }
    >
      <Icon size={nested ? 15 : 16} strokeWidth={1.75} />
      <span>{item.label}</span>
    </NavLink>
  );
}

/**
 * Couple portal sidebar: a few top links, then collapsible groups. The group holding
 * the current page opens automatically; other open/closed choices are remembered.
 */
export default function PortalSidebarNav({ basePath, visible, onNavigate }: {
  basePath: string;                              // "/portal" or "/admin/preview/<id>"
  visible: (item: PortalNavItem) => boolean;     // tier + tab-access filter
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const [open, setOpen] = useState<Record<string, boolean>>(readOpen);
  const path = (slug: string) => `${basePath}/${slug}`;
  const isActive = (slug: string) => location.pathname === path(slug) || location.pathname.startsWith(path(slug) + "/");

  const groups = PORTAL_NAV_GROUPS
    .map(g => ({ ...g, items: g.items.filter(visible) }))
    .filter(g => g.items.length > 0);
  const activeGroup = groups.find(g => g.items.some(i => isActive(i.slug)))?.id;

  useEffect(() => {
    if (activeGroup) setOpen(o => (o[activeGroup] ? o : { ...o, [activeGroup]: true }));
  }, [activeGroup]);

  const toggle = (id: string) => {
    setOpen(o => {
      const next = { ...o, [id]: !o[id] };
      try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  };

  return (
    <>
      {PORTAL_TOP_ITEMS.filter(visible).map(item => (
        <NavRow key={item.slug} to={path(item.slug)} item={item} onClick={onNavigate} />
      ))}

      {groups.map(group => {
        // A group with a single visible page (e.g. limited helpers) is just a link.
        if (group.items.length === 1) {
          const item = group.items[0];
          return <NavRow key={group.id} to={path(item.slug)} item={item} onClick={onNavigate} />;
        }
        const isOpen = !!open[group.id];
        const GroupIcon = group.icon;
        const holdsActive = group.id === activeGroup;
        return (
          <div key={group.id} className="pt-1">
            <button
              type="button"
              onClick={() => toggle(group.id)}
              aria-expanded={isOpen}
              className={`flex items-center gap-3 px-4 py-2.5 w-full rounded-lg font-body text-sm transition-all duration-200 ${
                holdsActive && !isOpen ? "text-sage-dark font-medium" : "text-foreground/80 hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <GroupIcon size={16} strokeWidth={1.75} />
              <span className="flex-1 text-left">{group.label}</span>
              <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="mt-0.5 mb-1 ml-5 pl-2.5 border-l border-border flex flex-col gap-0.5">
                {group.items.map(item => (
                  <NavRow key={item.slug} to={path(item.slug)} item={item} onClick={onNavigate} nested />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
