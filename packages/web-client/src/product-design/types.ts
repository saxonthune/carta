/** A parsed carta code block from a markdown file */
export interface CartaCodeBlock {
  /** Block name from frontmatter */
  name: string;
  /** Structure type from frontmatter (e.g., 'enumeration', 'state-machine') */
  type: string;
  /** Parsed YAML body content */
  body: Record<string, unknown>;
  /** Byte offset of the opening ``` in the source markdown */
  startOffset: number;
  /** Byte offset of the closing ``` in the source markdown (end of line) */
  endOffset: number;
}

/** Result of parsing a markdown file */
export interface ParsedDocument {
  /** Original markdown content */
  source: string;
  /** Extracted carta code blocks, in document order */
  blocks: CartaCodeBlock[];
}

/** Enumeration structure data (the body of a carta block with type: enumeration) */
export interface EnumerationData {
  kind: 'ordinal' | 'nominal';
  values: EnumerationValue[];
}

export interface EnumerationValue {
  key: string;
  remark?: string;
}
