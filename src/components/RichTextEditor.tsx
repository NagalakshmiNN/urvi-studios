"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import { toDisplayHtml } from "@/lib/richtext";

const FONTS = [
  { label: "Default font", value: "" },
  { label: "Elegant serif", value: "'Cormorant Garamond', Georgia, serif" },
  { label: "Clean sans-serif", value: "Arial, Helvetica, sans-serif" },
  { label: "Classic serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Flowing script", value: "'Brush Script MT', cursive" },
];

const COLORS = ["#2b2b2b", "#3F4827", "#A98238", "#a5333a", "#1d4e89", "#6a7444"];

function Btn({
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
      title={title}
      onMouseDown={(e) => e.preventDefault()} // keep editor selection/focus while clicking toolbar
      onClick={onClick}
      className={`rte-btn${active ? " active" : ""}`}
    >
      {children}
    </button>
  );
}

// A single rich-editing box for product Description — bold/italic/underline,
// text color, font, bullet/numbered lists, and real paragraph breaks (Enter
// for a new paragraph, Shift+Enter for a line break within one). Submits as
// HTML through a hidden input of the given `name`, so it drops straight into
// the existing FormData-based product forms with no other wiring needed.
export default function RichTextEditor({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const initialHtml = toDisplayHtml(defaultValue);
  const [html, setHtml] = useState(initialHtml);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Underline, TextStyle, Color, FontFamily],
    content: initialHtml,
    editorProps: { attributes: { class: "rte-content" } },
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
  });

  return (
    <div className="rte-wrapper">
      <div className="rte-toolbar">
        <Btn title="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <b>B</b>
        </Btn>
        <Btn title="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <i>I</i>
        </Btn>
        <Btn title="Underline" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <u>U</u>
        </Btn>
        <Btn title="Strikethrough" active={editor?.isActive("strike")} onClick={() => editor?.chain().focus().toggleStrike().run()}>
          <s>S</s>
        </Btn>
        <span className="rte-sep" />
        <Btn title="Bullet list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          • List
        </Btn>
        <Btn title="Numbered list" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          1. List
        </Btn>
        <span className="rte-sep" />
        <select
          className="rte-select"
          title="Font"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) editor?.chain().focus().setFontFamily(v).run();
            else editor?.chain().focus().unsetFontFamily().run();
          }}
        >
          {FONTS.map((f) => (
            <option key={f.label} value={f.value}>{f.label}</option>
          ))}
        </select>
        <span className="rte-colors" title="Text color">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor?.chain().focus().setColor(c).run()}
              className="rte-swatch"
              style={{ background: c }}
              aria-label={`Set text color ${c}`}
            />
          ))}
          <input
            type="color"
            className="rte-color-picker"
            title="Custom color"
            onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()}
          />
        </span>
        <span className="rte-sep" />
        <Btn title="Clear formatting" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}>
          Clear
        </Btn>
      </div>
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} readOnly />
    </div>
  );
}
