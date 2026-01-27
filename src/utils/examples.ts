/**
 * Load example .carta files bundled with the application
 * Uses Vite's import.meta.glob to bundle files at build time
 */

// Import all .carta files from the examples directory as raw strings
const exampleModules = import.meta.glob('/examples/*.carta', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

export interface Example {
  filename: string;
  title: string;
  description?: string;
  content: string;
}

/**
 * Get list of available example files
 */
export function getExamples(): Example[] {
  return Object.entries(exampleModules).map(([path, content]) => {
    const filename = path.split('/').pop() || '';

    // Parse the JSON to extract title and description
    let title = filename.replace('.carta', '').replace(/-/g, ' ');
    let description: string | undefined;

    try {
      const parsed = JSON.parse(content);
      if (parsed.title) {
        title = parsed.title;
      }
      if (parsed.description) {
        description = parsed.description;
      }
    } catch {
      // If parsing fails, use the filename as title
    }

    return {
      filename,
      title,
      description,
      content,
    };
  });
}

/**
 * Get a specific example by filename
 */
export function getExample(filename: string): Example | undefined {
  return getExamples().find(e => e.filename === filename);
}
