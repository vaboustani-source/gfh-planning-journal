import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Unlink } from "lucide-react";
import { useEffect } from "react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

function Toolbar({ editor }: { editor: Editor }) {
  if (!editor) return null;
  const btn = (active: boolean) =>
    `p-1.5 rounded hover:bg-sage/10 ${active ? "bg-sage/15 text-sage-dark" : "text-muted-foreground"}`;

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-muted/30 rounded-t-lg">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))} title="Bold">
        <Bold size={14} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))} title="Italic">
        <Italic size={14} />
      </button>
      <span className="mx-1 w-px h-4 bg-border" />
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))} title="Bullet list">
        <List size={14} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))} title="Numbered list">
        <ListOrdered size={14} />
      </button>
      <span className="mx-1 w-px h-4 bg-border" />
      <button type="button" onClick={setLink} className={btn(editor.isActive("link"))} title="Add link">
        <LinkIcon size={14} />
      </button>
      {editor.isActive("link") && (
        <button type="button" onClick={() => editor.chain().focus().unsetLink().run()} className={btn(false)} title="Remove link">
          <Unlink size={14} />
        </button>
      )}
    </div>
  );
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 140 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: "text-sage underline underline-offset-2" } }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "font-body text-sm text-foreground outline-none px-3 py-2 min-h-[var(--rte-min)] prose prose-sm max-w-none [&_a]:text-sage",
        "data-placeholder": placeholder ?? "",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  // Sync external value changes (e.g. signature prefill, reset)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (next && next !== current) {
      editor.commands.setContent(next, { emitUpdate: false });
    } else if (!next && current && current !== "<p></p>") {
      editor.commands.clearContent(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  return (
    <div
      className="rounded-lg border border-border bg-card focus-within:ring-2 focus-within:ring-sage/40"
      style={{ ["--rte-min" as any]: `${minHeight}px` }}
    >
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

/** Convert HTML to a plaintext fallback suitable for the text/plain MIME part. */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  let s = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}
