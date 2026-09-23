import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import MoodboardCard from "@/components/moodboard/MoodboardCard";
import PinterestBoardEmbed from "@/components/moodboard/PinterestBoardEmbed";
import { MOODBOARD_CATEGORIES, type MoodboardItem } from "@/lib/moodboard";

type Board = { title: string; wedding_date: string | null; pinterest_board_url: string | null; items: MoodboardItem[] };

/** View-only mood board for vendors (florist, designer, baker). No login; team notes excluded. */
export default function MoodBoardShare() {
  const { token } = useParams<{ token: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) { setState("missing"); return; }
    supabase.rpc("get_moodboard_by_token", { p_token: token }).then(({ data, error }) => {
      if (error || !data) { setState("missing"); return; }
      setBoard(data as unknown as Board);
      setState("ready");
    });
  }, [token]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    board?.items.forEach(i => { c[i.category] = (c[i.category] ?? 0) + 1; });
    return c;
  }, [board]);

  if (state === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }
  if (state === "missing" || !board) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6 text-center">
        <div>
          <p className="font-display text-2xl font-light text-foreground mb-2">This mood board isn't available</p>
          <p className="font-body text-sm text-muted-foreground">The link may have been turned off. Questions? Write to events@gilbertsvillefarmhouse.com</p>
        </div>
      </div>
    );
  }

  const shown = board.items.filter(i => filter === "all" || i.category === filter);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80">
        <div className="max-w-6xl mx-auto px-5 py-6">
          <p className="font-body text-[11px] uppercase tracking-widest text-muted-foreground">Gilbertsville Farmhouse · Mood Board</p>
          <h1 className="font-display text-3xl md:text-4xl font-light text-foreground mt-1">{board.title}</h1>
          {board.wedding_date && (
            <p className="font-body text-sm text-muted-foreground mt-1">{format(parseISO(board.wedding_date), "EEEE, MMMM d, yyyy")}</p>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-8 space-y-6">
        {board.pinterest_board_url && (
          <div className="rounded-xl bg-card border border-border p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="font-display text-lg font-light text-foreground">Their Pinterest board</p>
              <a href={board.pinterest_board_url} target="_blank" rel="noopener noreferrer" className="font-body text-xs text-muted-foreground hover:text-foreground">Open on Pinterest</a>
            </div>
            <PinterestBoardEmbed url={board.pinterest_board_url} />
          </div>
        )}

        {board.items.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[{ key: "all", label: "All" }, ...MOODBOARD_CATEGORIES.filter(c => counts[c.key])].map(c => (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={`rounded-full border px-3 py-1 font-body text-xs transition-colors ${
                  filter === c.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.label} <span className="opacity-60">{c.key === "all" ? board.items.length : counts[c.key]}</span>
              </button>
            ))}
          </div>
        )}

        {board.items.length === 0 ? (
          <p className="font-body text-sm text-muted-foreground">Nothing has been added yet.</p>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
            {shown.map(item => <MoodboardCard key={item.id} item={item} mode="view" />)}
          </div>
        )}

        <p className="font-body text-xs text-muted-foreground pt-6">Questions? Write to events@gilbertsvillefarmhouse.com</p>
      </main>
    </div>
  );
}
