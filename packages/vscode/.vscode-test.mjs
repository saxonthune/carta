import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'tests/integration/**/*.test.ts',
  workspaceFolder: 'tests/fixtures',
  mocha: {
    timeout: 20000,
  },
});
