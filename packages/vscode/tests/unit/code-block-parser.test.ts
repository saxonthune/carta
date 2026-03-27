import { describe, it, expect } from 'vitest';
import { parseDocument, updateBlock } from '../../src/code-block-parser.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PRIORITY_ENUM = `\`\`\`carta
name: Priority
type: enumeration
---
kind: ordinal
values:
  - key: low
    remark: Triaged but not urgent
  - key: medium
  - key: high
    remark: Needs attention this sprint
\`\`\``;

const STATUS_ENUM = `\`\`\`carta
name: Status
type: enumeration
---
kind: nominal
values:
  - key: open
  - key: closed
\`\`\``;

// ---------------------------------------------------------------------------
// Single block
// ---------------------------------------------------------------------------

describe('parseDocument — single block', () => {
  it('parses name, type, and body correctly', () => {
    const doc = parseDocument(PRIORITY_ENUM);
    expect(doc.blocks).toHaveLength(1);
    const block = doc.blocks[0];
    expect(block.name).toBe('Priority');
    expect(block.type).toBe('enumeration');
    expect(block.body.kind).toBe('ordinal');
    expect(Array.isArray(block.body.values)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Multiple blocks
// ---------------------------------------------------------------------------

describe('parseDocument — multiple blocks', () => {
  it('returns all blocks in document order', () => {
    const markdown = PRIORITY_ENUM + '\n\nSome prose.\n\n' + STATUS_ENUM;
    const doc = parseDocument(markdown);
    expect(doc.blocks).toHaveLength(2);
    expect(doc.blocks[0].name).toBe('Priority');
    expect(doc.blocks[1].name).toBe('Status');
  });
});

// ---------------------------------------------------------------------------
// Prose preservation
// ---------------------------------------------------------------------------

describe('updateBlock — prose preservation', () => {
  const prose1 = '# Title\n\nIntroductory paragraph.\n\n';
  const prose2 = '\n\nTrailing content.\n';
  const markdown = prose1 + PRIORITY_ENUM + prose2;

  it('preserves prose before and after the block', () => {
    const doc = parseDocument(markdown);
    const result = updateBlock(doc, 0, doc.blocks[0].body);
    expect(result.startsWith(prose1)).toBe(true);
    expect(result.endsWith(prose2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Round-trip
// ---------------------------------------------------------------------------

describe('round-trip', () => {
  it('re-parsing an unmodified block produces the same body', () => {
    const doc = parseDocument(PRIORITY_ENUM);
    const updated = updateBlock(doc, 0, doc.blocks[0].body);
    const doc2 = parseDocument(updated);
    expect(doc2.blocks).toHaveLength(1);
    expect(doc2.blocks[0].body).toEqual(doc.blocks[0].body);
  });

  it('updating a block value round-trips correctly', () => {
    const doc = parseDocument(PRIORITY_ENUM);
    const newBody = { kind: 'nominal', values: [{ key: 'x' }] };
    const updated = updateBlock(doc, 0, newBody);
    const doc2 = parseDocument(updated);
    expect(doc2.blocks[0].body.kind).toBe('nominal');
    const values = doc2.blocks[0].body.values as Array<{ key: string }>;
    expect(values).toHaveLength(1);
    expect(values[0].key).toBe('x');
  });
});

// ---------------------------------------------------------------------------
// No blocks / malformed
// ---------------------------------------------------------------------------

describe('parseDocument — edge cases', () => {
  it('returns empty blocks for plain markdown', () => {
    const doc = parseDocument('# Heading\n\nJust prose.\n');
    expect(doc.blocks).toHaveLength(0);
  });

  it('skips block missing --- separator', () => {
    const bad = '```carta\nname: Foo\ntype: enumeration\nkind: nominal\n```';
    const doc = parseDocument(bad);
    expect(doc.blocks).toHaveLength(0);
  });
});
