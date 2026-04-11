"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { useEffect, useState } from "react";
import { LinkPopover } from "@/components/composer/LinkPopover";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RichTextVariant = "full" | "compact" | "inline";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  maxChars?: number;
  variant?: RichTextVariant;
  onSubmit?: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
  onGifClick?: () => void;
  onPhotoClick?: () => void;
  /** When set, applies this color to the editor text (DM color preview) */
  textColor?: string;
}

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

function ToolBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className="h-6 w-6 rounded flex items-center justify-center text-[11px] font-mono transition-colors"
      style={{
        background: active ? "var(--amber-tint)" : "transparent",
        color: active ? "var(--amber)" : "var(--text-dim)",
      }}
      onMouseEnter={(e) =>
        !active && ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)")
      }
      onMouseLeave={(e) =>
        !active && ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-dim)")
      }
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// RichTextEditor
// ---------------------------------------------------------------------------

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something…",
  maxChars,
  variant = "full",
  onSubmit,
  autoFocus = false,
  disabled = false,
  onGifClick,
  onPhotoClick,
  textColor,
}: RichTextEditorProps) {
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Disable heading in compact/inline variants
        heading: variant === "full" ? { levels: [2, 3] } : false,
        blockquote: variant !== "inline",
        bulletList: variant !== "inline",
        orderedList: variant !== "inline",
        codeBlock: variant === "full",
        horizontalRule: false,
        hardBreak: {},
        // Disable StarterKit's built-in link so our custom Link extension doesn't conflict
        link: false,
      }),
      Placeholder.configure({ placeholder }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
          class: "rich-link",
        },
      }),
    ],
    content: value || "<p></p>",
    editable: !disabled,
    autofocus: autoFocus,
    onUpdate({ editor }) {
      const html = editor.isEmpty ? "" : editor.getHTML();
      onChange(html);
    },
    editorProps: {
      handleKeyDown(_view, event) {
        // Cmd/Ctrl+Enter → submit
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          onSubmit?.();
          return true;
        }
        // compact + inline: Enter (no shift) → submit; Shift+Enter inserts line break
        if ((variant === "compact" || variant === "inline") && event.key === "Enter" && !event.shiftKey) {
          onSubmit?.();
          return true;
        }
        return false;
      },
    },
  });

  // Sync external value resets (e.g. after form clear)
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value === "" && current !== "") {
      editor.commands.clearContent(true);
    }
  }, [value, editor]);

  // Count text characters (not HTML)
  const textLen = editor
    ? editor.state.doc.textContent.length
    : 0;
  const remaining = maxChars != null ? maxChars - textLen : null;
  // Show counter only when >= 400 chars typed (remaining <= 112)
  const showCounter = remaining != null && remaining <= 112;
  // Display clamped to 0 — never show negative
  const displayRemaining = remaining != null ? Math.max(0, remaining) : null;

  if (!editor) return null;

  const isInline = variant === "inline";
  const isCompact = variant === "compact";

  return (
    <div className="flex flex-col" style={{ opacity: disabled ? 0.5 : 1 }}>
      {/* Toolbar — hidden for inline */}
      {!isInline && (
        <div
          className="hidden md:flex items-center gap-0.5 px-1 py-1 border-b flex-wrap"
          style={{ borderColor: "var(--border)" }}
        >
          <ToolBtn
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold (⌘B)"
          >
            <strong>B</strong>
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic (⌘I)"
          >
            <em>I</em>
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            title="Strikethrough"
          >
            <s>S</s>
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive("code")}
            title="Inline code"
          >
            {"<>"}
          </ToolBtn>

          {!isCompact && (
            <>
              <span
                className="w-px h-4 mx-0.5 flex-shrink-0"
                style={{ background: "var(--border)" }}
              />
              <ToolBtn
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                active={editor.isActive("heading", { level: 2 })}
                title="Heading"
              >
                H
              </ToolBtn>
              <ToolBtn
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                active={editor.isActive("bulletList")}
                title="Bullet list"
              >
                •≡
              </ToolBtn>
              <ToolBtn
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                active={editor.isActive("orderedList")}
                title="Numbered list"
              >
                1≡
              </ToolBtn>
              <ToolBtn
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                active={editor.isActive("blockquote")}
                title="Blockquote"
              >
                &ldquo;
              </ToolBtn>
              <ToolBtn
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                active={editor.isActive("codeBlock")}
                title="Code block"
              >
                {"{ }"}
              </ToolBtn>
            </>
          )}

          <span
            className="w-px h-4 mx-0.5 flex-shrink-0"
            style={{ background: "var(--border)" }}
          />
          <div className="relative">
            <ToolBtn
              onClick={() => setShowLinkPopover((v) => !v)}
              active={editor.isActive("link") || showLinkPopover}
              title="Insert link"
            >
              🔗
            </ToolBtn>
            {showLinkPopover && editor && (
              <LinkPopover editor={editor} onClose={() => setShowLinkPopover(false)} />
            )}
          </div>

          {onPhotoClick && (
            <ToolBtn onClick={onPhotoClick} active={false} title="Attach photo">
              📷
            </ToolBtn>
          )}
          {onGifClick && (
            <ToolBtn onClick={onGifClick} active={false} title="Insert GIF">
              GIF
            </ToolBtn>
          )}
        </div>
      )}

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="rich-editor"
        style={{
          minHeight: isInline ? 32 : isCompact ? 72 : 120,
          maxHeight: isInline ? 120 : 400,
          overflowY: "auto",
          padding: isInline ? "4px 0" : "8px 12px",
          fontFamily: "var(--font-dm-sans)",
          color: textColor ?? "var(--text)",
          cursor: disabled ? "not-allowed" : "text",
        }}
      />

      {/* Char counter — only shown when >= 400 chars typed (Change 13) */}
      {showCounter && displayRemaining != null && (
        <div
          className="px-3 py-1 text-[10px] font-mono tabular-nums self-end"
          style={{
            color: displayRemaining < 10
              ? "#ef4444"
              : displayRemaining < 50
              ? "#c8860a"
              : "var(--text-dim)",
          }}
        >
          {displayRemaining}
        </div>
      )}
    </div>
  );
}
