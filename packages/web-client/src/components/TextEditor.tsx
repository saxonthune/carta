import { useEffect, useRef } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState, type Extension } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next';
import { oneDark } from '@codemirror/theme-one-dark';
import { useTextFileConnection } from '../hooks/useTextFileConnection';
import { useLanguageExtension } from '../hooks/useLanguageExtension';

interface TextEditorProps {
  filePath: string;
  syncUrl: string;
}

export default function TextEditor({ filePath, syncUrl }: TextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { ytext, awareness, isConnected } = useTextFileConnection(filePath, syncUrl);
  const languageExtension = useLanguageExtension(filePath);

  useEffect(() => {
    if (!containerRef.current || !ytext || !awareness) return;

    const extensions: Extension[] = [
      basicSetup,
      keymap.of(yUndoManagerKeymap),
      yCollab(ytext, awareness as Parameters<typeof yCollab>[1]),
      // Theme: dark by default. TODO: read from Carta theme context
      oneDark,
      // Fill container
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' },
      }),
    ];

    if (languageExtension) {
      extensions.push(languageExtension);
    }

    const state = EditorState.create({ extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [ytext, awareness, languageExtension]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {!isConnected && (
        <div className="px-4 py-2 text-xs text-content-muted bg-surface-depth-2 border-b border-border">
          Connecting...
        </div>
      )}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
