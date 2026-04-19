import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { EventParticipant, hexToRgba, darkenHex, initialOf } from "@/lib/messageUtils";

interface MessageComposerProps {
  onSend: (body: string, mentionIds: string[]) => Promise<void>;
  participants: EventParticipant[];
  currentEventUserId: string | null;
  placeholder?: string;
  className?: string;
}

interface Token {
  type: "text" | "mention";
  value: string; // text content or event_user_id
}

/** Build [[@id]] body string from tokens. */
function tokensToBody(tokens: Token[]): string {
  return tokens.map(t => (t.type === "text" ? t.value : `[[@${t.value}]]`)).join("");
}

/** Render tokens to DOM nodes inside the editor. */
function renderTokens(tokens: Token[], participantsById: Record<string, EventParticipant>): Node[] {
  const nodes: Node[] = [];
  tokens.forEach(t => {
    if (t.type === "text") {
      // Split text on newlines
      const lines = t.value.split("\n");
      lines.forEach((line, idx) => {
        if (idx > 0) nodes.push(document.createElement("br"));
        if (line.length > 0) nodes.push(document.createTextNode(line));
      });
    } else {
      const p = participantsById[t.value];
      const color = p?.color ?? "#6B6B6B";
      const name = p?.display_name ?? "Unknown";
      const span = document.createElement("span");
      span.contentEditable = "false";
      span.dataset.mention = t.value;
      span.className = "inline-flex items-center rounded-full font-body align-baseline select-none";
      span.style.fontSize = "13px";
      span.style.padding = "2px 6px";
      span.style.backgroundColor = p ? hexToRgba(color, 0.15) : "rgba(107,107,107,0.12)";
      span.style.borderLeft = `2px solid ${color}`;
      span.style.color = p ? darkenHex(color, 0.35) : "#6B6B6B";
      span.style.margin = "0 1px";
      span.textContent = `@${name}`;
      nodes.push(span);
    }
  });
  return nodes;
}

/** Read current editor DOM into tokens. */
function editorToTokens(editor: HTMLElement): Token[] {
  const tokens: Token[] = [];
  let buf = "";
  const flush = () => { if (buf) { tokens.push({ type: "text", value: buf }); buf = ""; } };
  const walk = (node: Node) => {
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        buf += child.textContent ?? "";
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (el.tagName === "BR") {
          buf += "\n";
        } else if (el.dataset.mention) {
          flush();
          tokens.push({ type: "mention", value: el.dataset.mention });
        } else if (el.tagName === "DIV" || el.tagName === "P") {
          // Some browsers wrap new lines in <div>
          if (buf.length > 0 || tokens.length > 0) buf += "\n";
          walk(child);
        } else {
          walk(child);
        }
      }
    });
  };
  walk(editor);
  flush();
  return tokens;
}

/** Place caret at end of editor */
function focusEnd(editor: HTMLElement) {
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

export function MessageComposer({
  onSend,
  participants,
  currentEventUserId,
  placeholder = "Send a message…",
  className = "",
}: MessageComposerProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  // Mention state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const triggerRangeRef = useRef<{ start: Node; startOffset: number } | null>(null);

  const participantsById = useMemo(() => {
    const map: Record<string, EventParticipant> = {};
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  const mentionable = useMemo(
    () => participants.filter(p => p.id !== currentEventUserId && p.display_name),
    [participants, currentEventUserId],
  );

  const filtered = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    if (!q) return mentionable.slice(0, 8);
    return mentionable
      .filter(p => (p.display_name ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [mentionable, mentionQuery]);

  useEffect(() => { setMentionIndex(0); }, [mentionQuery, mentionOpen]);

  const updateEmptyState = () => {
    const ed = editorRef.current;
    if (!ed) return;
    setIsEmpty(ed.textContent?.trim().length === 0 && ed.querySelectorAll("[data-mention]").length === 0);
  };

  /** Check selection for an active @ trigger and open/close accordingly */
  const checkMentionTrigger = () => {
    const ed = editorRef.current;
    const sel = window.getSelection();
    if (!ed || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!ed.contains(range.startContainer) && range.startContainer !== ed) return;

    let textNode: Text;
    let offset: number;
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      textNode = range.startContainer as Text;
      offset = range.startOffset;
    } else {
      // Caret is in an element node (e.g. the editor itself, or a wrapper div).
      // Find the nearest text node at/before the caret position.
      const container = range.startContainer as HTMLElement;
      const childIdx = range.startOffset;
      let candidate: Node | null =
        container.childNodes[childIdx - 1] ?? container.childNodes[childIdx] ?? null;
      // Descend into the last text node if candidate is an element
      while (candidate && candidate.nodeType === Node.ELEMENT_NODE) {
        const el = candidate as HTMLElement;
        if (el.dataset?.mention) { candidate = null; break; }
        candidate = el.lastChild;
      }
      if (!candidate || candidate.nodeType !== Node.TEXT_NODE) {
        setMentionOpen(false);
        return;
      }
      textNode = candidate as Text;
      offset = textNode.length;
    }
    const text = textNode.textContent ?? "";
    // Walk back to find last @ that starts a token
    let i = offset - 1;
    while (i >= 0) {
      const ch = text[i];
      if (ch === "@") break;
      if (/\s/.test(ch)) { setMentionOpen(false); return; }
      i--;
    }
    if (i < 0) { setMentionOpen(false); return; }
    // Verify char before @ is whitespace or start
    if (i > 0 && !/\s/.test(text[i - 1])) { setMentionOpen(false); return; }
    const query = text.slice(i + 1, offset);
    // If query has whitespace, exit
    if (/\s/.test(query)) { setMentionOpen(false); return; }
    triggerRangeRef.current = { start: textNode, startOffset: i };
    setMentionQuery(query);
    setMentionOpen(true);
  };

  const insertMention = (p: EventParticipant) => {
    const ed = editorRef.current;
    const trigger = triggerRangeRef.current;
    if (!ed || !trigger) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const caretRange = sel.getRangeAt(0);
    const range = document.createRange();
    range.setStart(trigger.start, trigger.startOffset);
    range.setEnd(caretRange.endContainer, caretRange.endOffset);
    range.deleteContents();

    const chip = document.createElement("span");
    chip.contentEditable = "false";
    chip.dataset.mention = p.id;
    chip.className = "inline-flex items-center rounded-full font-body align-baseline select-none";
    chip.style.fontSize = "13px";
    chip.style.padding = "2px 6px";
    chip.style.backgroundColor = hexToRgba(p.color ?? "#648857", 0.15);
    chip.style.borderLeft = `2px solid ${p.color ?? "#648857"}`;
    chip.style.color = darkenHex(p.color ?? "#648857", 0.35);
    chip.style.margin = "0 1px";
    chip.textContent = `@${p.display_name ?? "Unknown"}`;

    const space = document.createTextNode("\u00A0");
    range.insertNode(space);
    range.insertNode(chip);

    // Move caret after the space
    const newRange = document.createRange();
    newRange.setStartAfter(space);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    setMentionOpen(false);
    triggerRangeRef.current = null;
    updateEmptyState();
  };

  const handleSend = async () => {
    const ed = editorRef.current;
    if (!ed || sending) return;
    const tokens = editorToTokens(ed);
    const body = tokensToBody(tokens).trim();
    if (!body) return;
    const mentionIds: string[] = [];
    const seen = new Set<string>();
    tokens.forEach(t => {
      if (t.type === "mention" && !seen.has(t.value)) {
        seen.add(t.value);
        mentionIds.push(t.value);
      }
    });
    setSending(true);
    ed.innerHTML = "";
    setIsEmpty(true);
    setMentionOpen(false);
    try {
      await onSend(body, mentionIds);
    } finally {
      setSending(false);
      ed.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (mentionOpen && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex(i => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(i => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filtered[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionOpen(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // Strip formatting; never auto-convert raw @names to chips
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  return (
    <div className={`relative ${className}`}>
      {mentionOpen && filtered.length > 0 && (
        <div
          className="absolute left-0 right-12 bottom-full mb-2 z-50 rounded-xl border bg-card shadow-lg overflow-hidden max-h-64 overflow-y-auto"
          style={{ borderColor: "#E8E2D9", backgroundColor: "#FFFFFF" }}
        >
          {filtered.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); insertMention(p); }}
              onMouseEnter={() => setMentionIndex(idx)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
              style={{ backgroundColor: idx === mentionIndex ? "#FAF8F4" : "transparent" }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: p.color ?? "#648857" }}
              >
                <span className="font-display font-bold text-xs leading-none" style={{ color: "#FAF8F4" }}>
                  {initialOf(p.display_name)}
                </span>
              </div>
              <span className="font-body text-foreground" style={{ fontSize: "14px" }}>
                {p.display_name}
              </span>
              {p.role_in_event && (
                <span
                  className="font-body uppercase ml-auto"
                  style={{ fontSize: "10px", letterSpacing: "0.08em", color: "#6B6B6B" }}
                >
                  {p.role_in_event}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2.5">
        <div className="flex-1 relative">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            onInput={() => { updateEmptyState(); checkMentionTrigger(); }}
            onKeyUp={checkMentionTrigger}
            onClick={checkMentionTrigger}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={() => setTimeout(() => setMentionOpen(false), 150)}
            className="resize-none rounded-2xl border border-border bg-background px-4 py-2.5 font-body text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors max-h-32 overflow-y-auto leading-relaxed"
            style={{ minHeight: "42px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          />
          {isEmpty && (
            <div
              className="pointer-events-none absolute left-4 top-2.5 font-body text-sm text-muted-foreground/50"
              style={{ lineHeight: "1.5" }}
            >
              {placeholder}
            </div>
          )}
        </div>
        <button
          onClick={handleSend}
          disabled={isEmpty || sending}
          className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
      <p className="font-body text-[10px] text-muted-foreground mt-1.5 pl-1">
        Enter to send · Shift+Enter for new line · @ to mention
      </p>
    </div>
  );
}
