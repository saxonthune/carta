export function hexToHsl(hex) {
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
    if (max === r)
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g)
        h = ((b - r) / d + 2) / 6;
    else
        h = ((r - g) / d + 4) / 6;
    return { h: h * 360, s: s * 100, l: l * 100 };
}
export function hslToHex(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    const hue2rgb = (p, q, t) => {
        if (t < 0)
            t += 1;
        if (t > 1)
            t -= 1;
        if (t < 1 / 6)
            return p + (q - p) * 6 * t;
        if (t < 1 / 2)
            return q;
        if (t < 2 / 3)
            return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    }
    else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = (c) => {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
export function generateTints(hex, stops = 7) {
    const { h, s } = hexToHsl(hex);
    const tints = [];
    // Vary lightness from 92% (lightest) down to 45% (darkest)
    for (let i = 0; i < stops; i++) {
        const l = 92 - (i * (92 - 45)) / (stops - 1);
        tints.push(hslToHex(h, s, l));
    }
    return tints;
}
/**
 * Resolves the display color for a construct node based on schema color mode.
 * - 'enum': uses enumColorMap lookup on the designated field value, falls back to schema color
 * - 'instance': uses instanceColor if set, falls back to schema color
 * - 'default' / undefined: schema color
 */
export function resolveNodeColor(schema, data) {
    if (schema.colorMode === 'enum' && schema.enumColorField && schema.enumColorMap) {
        const fieldValue = String(data.values?.[schema.enumColorField] ?? '');
        if (fieldValue && schema.enumColorMap[fieldValue]) {
            return schema.enumColorMap[fieldValue];
        }
        return schema.color;
    }
    if (schema.colorMode === 'instance') {
        return data.instanceColor || schema.color;
    }
    // default / undefined
    return data.instanceColor || schema.color;
}
/**
 * Returns 'white' or 'black' text color for optimal contrast against the given background.
 * Uses WCAG relative luminance formula.
 */
export function getContrastTextColor(hex) {
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    // Calculate relative luminance (WCAG formula)
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // Use white text on dark backgrounds, black on light backgrounds
    return luminance > 0.5 ? 'black' : 'white';
}
