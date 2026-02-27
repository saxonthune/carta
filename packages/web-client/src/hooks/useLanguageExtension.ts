import { useState, useEffect } from 'react';
import type { Extension } from '@codemirror/state';

/** Map file extensions to lazy-loaded CodeMirror language support */
const LANGUAGE_MAP: Record<string, () => Promise<Extension>> = {
  md: () => import('@codemirror/lang-markdown').then(m => m.markdown()),
  json: () => import('@codemirror/lang-json').then(m => m.json()),
  js: () => import('@codemirror/lang-javascript').then(m => m.javascript()),
  mjs: () => import('@codemirror/lang-javascript').then(m => m.javascript()),
  ts: () => import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: true })),
  tsx: () => import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: true, jsx: true })),
  jsx: () => import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true })),
  yaml: () => import('@codemirror/lang-yaml').then(m => m.yaml()),
  yml: () => import('@codemirror/lang-yaml').then(m => m.yaml()),
  html: () => import('@codemirror/lang-html').then(m => m.html()),
  css: () => import('@codemirror/lang-css').then(m => m.css()),
};

/**
 * Dynamically loads CodeMirror language extension for a filename.
 * Returns null for unknown extensions (plain text, no highlighting).
 */
export function useLanguageExtension(filename: string): Extension | null {
  const [ext, setExt] = useState<Extension | null>(null);

  useEffect(() => {
    const match = filename.match(/\.([^.]+)$/);
    const fileExt = match?.[1]?.toLowerCase();
    if (!fileExt || !LANGUAGE_MAP[fileExt]) {
      setExt(null);
      return;
    }

    let cancelled = false;
    LANGUAGE_MAP[fileExt]!().then(langExt => {
      if (!cancelled) setExt(langExt);
    });
    return () => { cancelled = true; };
  }, [filename]);

  return ext;
}
