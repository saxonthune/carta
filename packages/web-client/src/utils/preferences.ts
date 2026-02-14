const PREFIX = 'carta-';

export function getLastDocumentId(): string | null {
  return localStorage.getItem(`${PREFIX}last-document-id`);
}

export function setLastDocumentId(id: string): void {
  localStorage.setItem(`${PREFIX}last-document-id`, id);
}
