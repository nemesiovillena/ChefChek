import { EditorProvider } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import ListItem from '@tiptap/extension-list-item';
import TextStyle from '@tiptap/extension-text-style';
import './tiptap-editor.css';

export function TipTapEditor({ content, onChange, editable = true }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['left', 'center', 'right'],
      }),
      ListItem,
      TextStyle,
    ],
    content,
    onUpdate: () => {
      if (onChange && editor) {
        onChange(editor.getJSON());
      }
    },
    editable,
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="tiptap-editor">
      <EditorContent editor={editor} />
    </div>
  );
}

import { useEditor, EditorContent } from '@tiptap/react';