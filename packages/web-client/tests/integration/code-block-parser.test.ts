import { describe, it, expect } from 'vitest';
import { parseDocument, updateBlock, asEnumeration } from '../../src/product-design/index.js';

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

const SEVERITY_ENUM = `\`\`\`carta
name: Severity
type: enumeration
---
kind: ordinal
values:
  - key: low
  - key: high
\`\`\``;

const NON_CARTA_BLOCK = `\`\`\`typescript
const x = 1;
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

  it('sets startOffset to 0 for block at start of file', () => {
    const doc = parseDocument(PRIORITY_ENUM);
    expect(doc.blocks[0].startOffset).toBe(0);
  });

  it('sets endOffset to full length of single block', () => {
    const doc = parseDocument(PRIORITY_ENUM);
    expect(doc.blocks[0].endOffset).toBe(PRIORITY_ENUM.length);
  });
});

// ---------------------------------------------------------------------------
// Multiple blocks
// ---------------------------------------------------------------------------

describe('parseDocument — multiple blocks', () => {
  const markdown = [
    '# Enumerations\n\n',
    PRIORITY_ENUM,
    '\n\nSome prose here.\n\n',
    STATUS_ENUM,
    '\n\nMore prose.\n\n',
    SEVERITY_ENUM,
    '\n',
  ].join('');

  it('returns 3 blocks in document order', () => {
    const doc = parseDocument(markdown);
    expect(doc.blocks).toHaveLength(3);
    expect(doc.blocks[0].name).toBe('Priority');
    expect(doc.blocks[1].name).toBe('Status');
    expect(doc.blocks[2].name).toBe('Severity');
  });

  it('each block has correct type', () => {
    const doc = parseDocument(markdown);
    for (const block of doc.blocks) {
      expect(block.type).toBe('enumeration');
    }
  });
});

// ---------------------------------------------------------------------------
// Prose preservation
// ---------------------------------------------------------------------------

describe('updateBlock — prose preservation', () => {
  const prose1 = '# Title\n\nIntroductory paragraph.\n\n';
  const prose2 = '\n\nSome middle prose.\n\n';
  const prose3 = '\n\nTrailing content.\n';
  const markdown = prose1 + PRIORITY_ENUM + prose2 + STATUS_ENUM + prose3;

  it('preserves prose before, between, and after blocks', () => {
    const doc = parseDocument(markdown);
    const result = updateBlock(doc, 0, doc.blocks[0].body);
    expect(result.startsWith(prose1)).toBe(true);
    expect(result.includes(prose2)).toBe(true);
    expect(result.endsWith(prose3)).toBe(true);
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
// Enumeration parsing
// ---------------------------------------------------------------------------

describe('asEnumeration', () => {
  it('returns typed EnumerationData', () => {
    const doc = parseDocument(PRIORITY_ENUM);
    const data = asEnumeration(doc.blocks[0]);
    expect(data.kind).toBe('ordinal');
    expect(data.values).toHaveLength(3);
    expect(data.values[0].key).toBe('low');
    expect(data.values[0].remark).toBe('Triaged but not urgent');
    expect(data.values[1].key).toBe('medium');
    expect(data.values[1].remark).toBeUndefined();
    expect(data.values[2].key).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// No blocks
// ---------------------------------------------------------------------------

describe('parseDocument — no blocks', () => {
  it('returns empty blocks array for plain markdown', () => {
    const doc = parseDocument('# Just a heading\n\nSome prose without any code blocks.\n');
    expect(doc.blocks).toHaveLength(0);
  });

  it('returns empty blocks array for empty string', () => {
    const doc = parseDocument('');
    expect(doc.blocks).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Malformed frontmatter
// ---------------------------------------------------------------------------

describe('parseDocument — malformed frontmatter', () => {
  it('skips block missing --- separator', () => {
    const bad = '```carta\nname: Foo\ntype: enumeration\nkind: nominal\n```';
    const doc = parseDocument(bad);
    expect(doc.blocks).toHaveLength(0);
  });

  it('skips block missing name field', () => {
    const bad = '```carta\ntype: enumeration\n---\nkind: nominal\n```';
    const doc = parseDocument(bad);
    expect(doc.blocks).toHaveLength(0);
  });

  it('skips block missing type field', () => {
    const bad = '```carta\nname: Foo\n---\nkind: nominal\n```';
    const doc = parseDocument(bad);
    expect(doc.blocks).toHaveLength(0);
  });

  it('still parses valid blocks that follow a malformed one', () => {
    const bad = '```carta\ntype: enumeration\n---\nkind: nominal\n```';
    const markdown = bad + '\n\n' + PRIORITY_ENUM;
    const doc = parseDocument(markdown);
    expect(doc.blocks).toHaveLength(1);
    expect(doc.blocks[0].name).toBe('Priority');
  });
});

// ---------------------------------------------------------------------------
// Adjacent blocks
// ---------------------------------------------------------------------------

describe('parseDocument — adjacent blocks', () => {
  it('parses two blocks with no prose between them', () => {
    const markdown = PRIORITY_ENUM + '\n' + STATUS_ENUM;
    const doc = parseDocument(markdown);
    expect(doc.blocks).toHaveLength(2);
    expect(doc.blocks[0].name).toBe('Priority');
    expect(doc.blocks[1].name).toBe('Status');
  });

  it('offsets are non-overlapping', () => {
    const markdown = PRIORITY_ENUM + '\n' + STATUS_ENUM;
    const doc = parseDocument(markdown);
    expect(doc.blocks[0].endOffset).toBeLessThanOrEqual(doc.blocks[1].startOffset);
  });
});

// ---------------------------------------------------------------------------
// Non-carta code blocks
// ---------------------------------------------------------------------------

describe('parseDocument — non-carta code blocks', () => {
  it('ignores typescript fenced blocks', () => {
    const markdown = NON_CARTA_BLOCK + '\n\n' + PRIORITY_ENUM;
    const doc = parseDocument(markdown);
    expect(doc.blocks).toHaveLength(1);
    expect(doc.blocks[0].name).toBe('Priority');
  });

  it('returns 0 blocks for markdown with only non-carta blocks', () => {
    const doc = parseDocument(NON_CARTA_BLOCK);
    expect(doc.blocks).toHaveLength(0);
  });
});
