import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export interface CartaCodeBlock {
  name: string;
  type: string;
  body: Record<string, unknown>;
  startOffset: number;
  endOffset: number;
}

export interface ParsedDocument {
  source: string;
  blocks: CartaCodeBlock[];
}

// Matches fenced carta code blocks: ```carta\n...\n```
const CARTA_BLOCK_RE = /^```carta\s*\n([\s\S]*?)^```[ \t]*$/gm;

function parseCartaBlock(
  yamlContent: string,
): { name: string; type: string; body: Record<string, unknown> } | null {
  const separatorIndex = yamlContent.indexOf('\n---\n');
  if (separatorIndex === -1) {
    return null;
  }

  try {
    const frontmatter = parseYaml(yamlContent.slice(0, separatorIndex)) as Record<string, unknown>;
    const body = parseYaml(yamlContent.slice(separatorIndex + 5)) as Record<string, unknown>;

    if (typeof frontmatter?.name !== 'string' || typeof frontmatter?.type !== 'string') {
      return null;
    }

    return { name: frontmatter.name, type: frontmatter.type, body: body ?? {} };
  } catch {
    return null;
  }
}

/** Parse a markdown string, extracting all carta code blocks */
export function parseDocument(markdown: string): ParsedDocument {
  const blocks: CartaCodeBlock[] = [];
  let match: RegExpExecArray | null;

  CARTA_BLOCK_RE.lastIndex = 0;
  while ((match = CARTA_BLOCK_RE.exec(markdown)) !== null) {
    const yamlContent = match[1];
    const parsed = parseCartaBlock(yamlContent);
    if (parsed === null) continue;

    blocks.push({
      name: parsed.name,
      type: parsed.type,
      body: parsed.body,
      startOffset: match.index,
      endOffset: match.index + match[0].length,
    });
  }

  return { source: markdown, blocks };
}

/** Serialize a modified block back into the document, preserving all other content */
export function updateBlock(
  doc: ParsedDocument,
  blockIndex: number,
  newBody: Record<string, unknown>,
): string {
  const block = doc.blocks[blockIndex];
  if (block === undefined) {
    throw new RangeError(`Block index ${blockIndex} out of range`);
  }

  const originalBlock = doc.source.slice(block.startOffset, block.endOffset);
  const innerContent = originalBlock.slice('```carta\n'.length, originalBlock.lastIndexOf('\n```'));
  const separatorIndex = innerContent.indexOf('\n---\n');
  const frontmatterStr = innerContent.slice(0, separatorIndex);

  const newBodyYaml = stringifyYaml(newBody);
  const newBlock = `\`\`\`carta\n${frontmatterStr}\n---\n${newBodyYaml}\`\`\``;

  return doc.source.slice(0, block.startOffset) + newBlock + doc.source.slice(block.endOffset);
}
