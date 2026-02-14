/**
 * Generate fun random document names like "Cosmic Platypus" or "Swift Nebula"
 */

const adjectives = [
  'Swift', 'Cosmic', 'Electric', 'Quantum', 'Stellar',
  'Nimble', 'Radiant', 'Crystal', 'Velvet', 'Golden',
  'Silver', 'Mystic', 'Arctic', 'Tropical', 'Digital',
  'Sonic', 'Neon', 'Lunar', 'Solar', 'Astral',
];

const nouns = [
  'Phoenix', 'Nebula', 'Cascade', 'Horizon', 'Prism',
  'Aurora', 'Vertex', 'Cipher', 'Mosaic', 'Beacon',
  'Catalyst', 'Nexus', 'Zenith', 'Odyssey', 'Spark',
  'Vector', 'Pulse', 'Wave', 'Echo', 'Flux',
];

/**
 * Generate a random document name like "Cosmic-Phoenix-42"
 */
export function generateRandomName(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}-${noun}-${num}`;
}
