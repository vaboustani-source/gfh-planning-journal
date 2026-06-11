import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const LIBRARIES = [
  { slug: "journal", label: "Journal" },
  { slug: "preferred-vendors", label: "Preferred Vendors" },
  { slug: "decor-rentals", label: "Décor Rentals" },
  { slug: "experiences", label: "Experiences" },
  { slug: "layouts", label: "Table Layouts" },
  { slug: "resources", label: "Resources" },
  { slug: "forms", label: "Forms" },
  { slug: "contract-templates", label: "Contract Templates" },
  { slug: "email-copy", label: "Email Copy" },
  { slug: "automated-emails", label: "Automated Emails" },
  { slug: "integrations", label: "Integrations" },
];

const ADMIN_ONLY = [
  { slug: "team", label: "Team & Roles" },
];

export default function SettingsLayout() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [drawerOpen, setDrawerOpen] = useState(false);

  const SidebarInner = ({ onItemClick }: { onItemClick?: () => void }) => (
    <div className="flex flex-col h-full">
      <div className="pt-8 pl-6 pb-2">
        <h1 className="font-display text-2xl font-light" style={{ color: "#2C3E2D" }}>
          Settings
        </h1>
      </div>

      <p
        className="font-body uppercase pl-6 mt-8 mb-4"
        style={{ color: "#6B6B6B", fontSize: "11px", letterSpacing: "2px" }}
      >
        GFH Libraries
      </p>

      <nav className="flex-1">
        {LIBRARIES.map((item) => (
          <NavLink
            key={item.slug}
            to={`/admin/settings/${item.slug}`}
            onClick={onItemClick}
            className={({ isActive }) =>
              [
                "block font-body transition-colors",
                "pl-6 pr-4",
                isActive
                  ? "border-l-[3px]"
                  : "border-l-[3px] border-transparent hover:bg-[#FAF8F4]",
              ].join(" ")
            }
            style={({ isActive }) =>
              isActive
                ? {
                    fontSize: "15px",
                    paddingTop: "12px",
                    paddingBottom: "12px",
                    paddingLeft: "21px", // 24 - 3px border
                    backgroundColor: "#FAF8F4",
                    borderLeftColor: "#2C3E2D",
                    color: "#2C3E2D",
                  }
                : {
                    fontSize: "15px",
                    paddingTop: "12px",
                    paddingBottom: "12px",
                    paddingLeft: "21px",
                    color: "#1A1A1A",
                  }
            }
          >
            {item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <p
              className="font-body uppercase pl-6 mt-8 mb-4"
              style={{ color: "#6B6B6B", fontSize: "11px", letterSpacing: "2px" }}
            >
              Admin
            </p>
            {ADMIN_ONLY.map((item) => (
              <NavLink
                key={item.slug}
                to={`/admin/settings/${item.slug}`}
                onClick={onItemClick}
                className={({ isActive }) =>
                  [
                    "block font-body transition-colors pl-6 pr-4",
                    isActive ? "border-l-[3px]" : "border-l-[3px] border-transparent hover:bg-[#FAF8F4]",
                  ].join(" ")
                }
                style={({ isActive }) =>
                  isActive
                    ? { fontSize: "15px", paddingTop: "12px", paddingBottom: "12px", paddingLeft: "21px", backgroundColor: "#FAF8F4", borderLeftColor: "#2C3E2D", color: "#2C3E2D" }
                    : { fontSize: "15px", paddingTop: "12px", paddingBottom: "12px", paddingLeft: "21px", color: "#1A1A1A" }
                }
              >
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <button
        onClick={() => navigate("/admin")}
        className="font-body text-left pl-6 pb-6 pt-4 hover:underline"
        style={{ color: "#6B6B6B", fontSize: "13px" }}
      >
        ← Back to admin
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#FAF8F4" }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col shrink-0"
        style={{
          width: "260px",
          backgroundColor: "#FFFFFF",
          borderRight: "1px solid #E8E2D9",
          minHeight: "100vh",
        }}
      >
        <SidebarInner />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className="relative flex flex-col"
            style={{
              width: "260px",
              backgroundColor: "#FFFFFF",
              borderRight: "1px solid #E8E2D9",
            }}
          >
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-4 p-1"
              style={{ color: "#6B6B6B" }}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <SidebarInner onItemClick={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0" style={{ backgroundColor: "#FAF8F4" }}>
        <div className="md:hidden p-3 border-b" style={{ borderColor: "#E8E2D9" }}>
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded hover:bg-[#FAF8F4]"
            style={{ color: "#6B6B6B" }}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>
        <div style={{ padding: "48px" }} className="max-md:!p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
