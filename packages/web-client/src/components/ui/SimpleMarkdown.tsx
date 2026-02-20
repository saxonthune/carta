import { useMemo } from 'react';
import { marked } from 'marked';
import type { CSSProperties } from 'react';

interface SimpleMarkdownProps {
  content: string;
  style?: CSSProperties;
  className?: string;
}

// Configure marked once at module level
const renderer = new marked.Renderer();

// Disable images — render as alt text
renderer.image = function({ text }) {
  return text || '';
};

// Disable links — render as plain text
renderer.link = function({ text }) {
  return text || '';
};

// Disable raw HTML passthrough
renderer.html = function() {
  return '';
};

const markedOptions = {
  renderer,
  gfm: true,        // GitHub Flavored Markdown (for strikethrough ~~)
  breaks: true,      // Convert \n to <br> (natural for note-taking)
};

export function SimpleMarkdown({ content, style, className }: SimpleMarkdownProps) {
  const html = useMemo(() => {
    return marked.parse(content, markedOptions) as string;
  }, [content]);

  return (
    <div
      className={`simple-markdown ${className ?? ''}`}
      style={{ ...style, color: 'inherit' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
