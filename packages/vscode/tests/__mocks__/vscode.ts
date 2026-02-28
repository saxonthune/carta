// Minimal vscode module mock for unit tests

export const Uri = {
  joinPath: (...args: unknown[]) => ({ fsPath: args.join('/') }),
  file: (path: string) => ({ fsPath: path }),
};

export const workspace = {
  workspaceFolders: null as unknown,
  getConfiguration: () => ({
    get: () => undefined,
  }),
};

export const window = {
  registerCustomEditorProvider: () => ({ dispose: () => {} }),
  showErrorMessage: () => {},
  showInformationMessage: () => {},
  showInputBox: () => Promise.resolve(undefined),
};

export const commands = {
  registerCommand: () => ({ dispose: () => {} }),
};
