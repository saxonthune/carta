# Component Smoke Tests

## Motivation

Integration tests only use `renderHook()` — they verify hook state but never render actual components. An agent can put UI in the wrong place and pass all tests. Component-level smoke tests verify what appears in the DOM, catching agent drift (e.g., the page-description-ui incident where description editing landed in the dropdown instead of the trigger bar).

## Design Constraint

Establish a component rendering test pattern alongside the existing hook-based integration tests. Tests use `render()` from `@testing-library/react` with existing test setup, asserting on DOM structure — not visual appearance.

## Do NOT

- Do NOT modify existing integration tests — this is additive
- Do NOT add snapshot tests — they're brittle and agents can't review diffs
- Do NOT test internal component state — test what the user sees in the DOM
- Do NOT add new dependencies beyond `@testing-library/user-event`
- Do NOT use `TestProviders` or a real Yjs adapter — PageSwitcher is a presentational component that takes props directly
- Do NOT add an `organizers` field to mock Page objects — the `Page` type has: `id`, `name`, `description?`, `order`, `nodes`, `edges`

## Files to Modify

1. `packages/web-client/package.json` — add `@testing-library/user-event` as devDependency if not already present
2. **NEW** `packages/web-client/tests/components/PageSwitcher.test.tsx` — component smoke tests for PageSwitcher
3. **NEW** `packages/web-client/tests/e2e/page-switcher.spec.ts` — E2E spec for page switching
4. `packages/web-client/tests/e2e/helpers/CartaPage.ts` — add page-switcher helper methods

## Implementation Steps

### Step 1: Install @testing-library/user-event

```bash
cd packages/web-client && pnpm add -D @testing-library/user-event
```

### Step 2: Create PageSwitcher component test file

Create `packages/web-client/tests/components/PageSwitcher.test.tsx`.

PageSwitcher is a presentational component at `src/components/PageSwitcher.tsx`. It takes these props:

```typescript
interface PageSwitcherProps {
  pages: Page[];
  activePage: string | undefined;
  onSetActivePage: (pageId: string) => void;
  onCreatePage: (name: string) => void;
  onDeletePage: (pageId: string) => boolean;
  onUpdatePage: (pageId: string, updates: Partial<Omit<Page, 'id' | 'nodes' | 'edges' | 'deployables'>>) => void;
  onDuplicatePage: (pageId: string, newName: string) => void;
}
```

The `Page` type (from `@carta/domain`) is:
```typescript
interface Page {
  id: string;
  name: string;
  description?: string;
  order: number;
  nodes: unknown[];
  edges: unknown[];
}
```

Test file structure:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PageSwitcher from '../../src/components/PageSwitcher';
import type { Page } from '@carta/domain';

function createTestPage(overrides: Partial<Page> = {}): Page {
  return {
    id: 'page-1',
    name: 'Main',
    order: 0,
    nodes: [],
    edges: [],
    ...overrides,
  };
}

const defaultProps = {
  pages: [createTestPage()],
  activePage: 'page-1',
  onSetActivePage: vi.fn(),
  onCreatePage: vi.fn(),
  onDeletePage: vi.fn(() => true),
  onUpdatePage: vi.fn(),
  onDuplicatePage: vi.fn(),
};
```

**Note:** PageSwitcher uses `@dnd-kit/core` and `@dnd-kit/sortable` for drag-to-reorder in edit mode. The component renders `DndContext` only when `editMode` is true. The basic rendering tests (trigger bar, dropdown open/close, page selection) do NOT enter edit mode, so dnd-kit should not cause issues. If dnd-kit causes jsdom errors, mock it:
```tsx
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => children,
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => children,
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
  }),
}));
```

Write these test cases:

**`describe('PageSwitcher')` > `describe('trigger bar')`:**
- `it('should render current page name')` — find text "Main" in the document
- `it('should enter inline rename mode when clicking page name')` — click the page name span, expect an input element to appear
- `it('should have a dropdown toggle button')` — find a button that toggles the dropdown (look for chevron/arrow icon button)

**`describe('PageSwitcher')` > `describe('dropdown')`:**
- `it('should open dropdown when clicking toggle button')` — click the chevron button, verify page rows appear
- `it('should show page names in dropdown rows')` — with multiple pages, verify each name appears
- `it('should call onSetActivePage when clicking a page row')` — click a non-active page row, verify callback
- `it('should show New Page button')` — open dropdown, find "New Page" text/button
- `it('should close dropdown when clicking toggle again')` — open then close, verify rows disappear

**`describe('PageSwitcher')` > `describe('structural assertions')`:**
- `it('should not render textarea in dropdown rows')` — open dropdown, query for textarea elements within the dropdown, expect none. This prevents description editing from leaking into the dropdown.
- `it('should render description panel outside dropdown')` — with description button clicked (and dropdown closed), verify textarea exists. Then open dropdown, verify textarea disappears (guarded by `isDescriptionOpen && !isOpen`).

### Step 3: Create E2E page-switcher spec

Create `packages/web-client/tests/e2e/page-switcher.spec.ts`.

Follow the pattern from `new-user-experience.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

test.describe('Page Switcher', () => {
  let cartaPage: CartaPage;

  test.beforeEach(async ({ page }) => {
    cartaPage = new CartaPage(page);
    await cartaPage.goto();
  });

  // tests here
});
```

Test cases:
- `should display page name in trigger bar` — verify the starter document's first page name is visible
- `should open dropdown and show page list` — click chevron, verify page rows
- `should create a new page` — open dropdown, click "New Page", verify new page appears
- `should switch active page` — create second page, click it, verify trigger bar updates
- `should rename a page via inline edit` — click page name, type new name, press Enter, verify

Add helper methods to `CartaPage.ts`:
```typescript
getPageSwitcherTrigger() {
  // Locate the page switcher trigger bar - look for the component's root element
  return this.page.locator('[data-testid="page-switcher"]').first();
  // Fallback if no testid: locate by the page name text within the trigger area
}

async openPageDropdown() {
  // Click the chevron/dropdown toggle button in the page switcher
}

getPageRows() {
  // Return locators for page rows in the open dropdown
}
```

**Note:** If PageSwitcher lacks `data-testid` attributes, the E2E tests should use semantic locators (text content, role, visible labels). Do NOT add `data-testid` to PageSwitcher.tsx — that's a source code change out of scope. Use Playwright's text/role locators instead.

### Step 4: Verify

```bash
pnpm build && pnpm test
```

All existing tests plus new component tests should pass. The E2E tests verify separately:
```bash
pnpm test:e2e --grep "Page Switcher"
```

## Constraints

- `erasableSyntaxOnly` — no constructor parameter shorthand
- Existing test setup (`vitest.setup.ts`) mocks `matchMedia`, `ResizeObserver`, `crypto` — component tests inherit this automatically
- Component tests go in `tests/components/` directory (new directory, parallel to `tests/integration/`)
- E2E tests go in existing `tests/e2e/` directory
- Follow existing test naming: `describe` blocks named after feature, `it` blocks start with "should"
- `Page` type: `{ id, name, description?, order, nodes, edges }` — NO `organizers` field

## Verification

- `pnpm build` passes
- `pnpm test` passes (includes new component tests picked up by `tests/**/*.test.{ts,tsx}` glob)
- New test file `tests/components/PageSwitcher.test.tsx` has at least 8 passing tests
- New E2E spec `tests/e2e/page-switcher.spec.ts` has at least 4 tests

## Plan-Specific Checks

```bash
# Verify no snapshot tests were created
! find packages/web-client/tests/components -name '*.snap' 2>/dev/null | grep .

# Verify component test file exists and has describe blocks
grep -c 'describe(' packages/web-client/tests/components/PageSwitcher.test.tsx
```
