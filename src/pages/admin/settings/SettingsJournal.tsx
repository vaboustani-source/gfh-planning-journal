import { useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";

export default function SettingsJournal() {
  const navigate = useNavigate();
  return (
    <div className="max-w-3xl">
      <h2 className="font-display text-3xl font-light" style={{ color: "#2C3E2D" }}>
        Planning Journal
      </h2>
      <p className="font-body mt-2" style={{ color: "#6B6B6B", fontSize: "14px" }}>
        Your day-to-day operating view across every event.
      </p>

      <div
        className="mt-8 rounded-xl p-10 text-center"
        style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E2D9" }}
      >
        <BookOpen size={28} className="mx-auto mb-3" style={{ color: "#C9A84C" }} />
        <p className="font-display text-xl font-light" style={{ color: "#1A1A1A" }}>
          The Journal lives on the dashboard.
        </p>
        <p className="font-body mt-2" style={{ color: "#6B6B6B", fontSize: "14px" }}>
          It's where active events, attention items, and the season overview converge.
        </p>
        <button
          onClick={() => navigate("/admin")}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-body text-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#2C3E2D", color: "#FFFFFF" }}
        >
          Open the Journal →
        </button>
      </div>
    </div>
  );
}
