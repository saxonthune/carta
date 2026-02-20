export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  h /= 360;
  s /= 100;
  l /= 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export const INSTANCE_COLOR_PALETTE = [
  '#e8a0a0', // red     — hsl(0, 55%, 77%)
  '#e8b88a', // orange  — hsl(25, 60%, 73%)
  '#e0d08a', // yellow  — hsl(48, 50%, 71%)
  '#8ad4a0', // green   — hsl(140, 45%, 68%)
  '#8ac8d4', // cyan    — hsl(190, 45%, 68%)
  '#8aace8', // blue    — hsl(220, 60%, 73%)
  '#b8a0e0', // violet  — hsl(265, 45%, 75%)
  '#e0a0c8', // pink    — hsl(330, 50%, 75%)
];

/**
 * Resolves the display color for a construct node.
 * If instanceColors is enabled on the schema and an instanceColor is set, uses the instance color.
 * Otherwise uses the schema color.
 */
export function resolveNodeColor(
  schema: { color: string; instanceColors?: boolean },
  data: { instanceColor?: string },
): string {
  if (schema.instanceColors && data.instanceColor) {
    return data.instanceColor;
  }
  return schema.color;
}

/**
 * Coerces old property shapes on read — no migration pipeline needed.
 * Call this wherever schemas are read from Yjs.
 */
export function normalizeSchema<T>(raw: T): T {
  const schema = { ...raw } as Record<string, unknown>;
  // Migrate old color properties to instanceColors
  if (schema.colorMode === 'instance' || schema.colorMode === 'enum' ||
      schema.backgroundColorPolicy === 'tints' || schema.backgroundColorPolicy === 'any') {
    (schema as Record<string, unknown>).instanceColors = true;
  }
  // Remove old properties
  delete schema.colorMode;
  delete schema.backgroundColorPolicy;
  delete schema.enumColorField;
  delete schema.enumColorMap;
  delete schema.enumIconField;
  delete schema.enumIconMap;
  return schema as T;
}

