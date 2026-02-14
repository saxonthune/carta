# Canvas Engine Testing Strategy

## The d3 Question

### What d3-zoom needs from the DOM

d3-zoom attaches event listeners (`wheel`, `mousedown`, `touchstart`, `pointermove`, `pointerup`) and reads:
- `element.getBoundingClientRect()` — for coordinate transforms
- `element.clientWidth` / `element.clientHeight` — for extent computation
- `element.__zoom` — d3's internal transform state (expando property)
- `event.preventDefault()` / `event.stopPropagation()` — standard event methods

### What jsdom provides

jsdom implements most of these, with notable gaps:
- `getBoundingClientRect()` → returns `{ x: 0, y: 0, width: 0, height: 0, ... }` always. **This breaks `fitView` and `screenToCanvas`.** d3-zoom's extent computation uses element dimensions, which are all zero in jsdom.
- `clientWidth` / `clientHeight` → returns 0. Same problem.
- Event dispatching works, but synthetic events don't bubble through the DOM the same way as real browser events. `wheel` events specifically may not trigger d3-zoom's handlers correctly because d3 uses `addEventListener` directly (not React's synthetic events).
- No layout engine — `offsetLeft`, `offsetTop`, computed styles are all zeros.

### The verdict

**d3-zoom cannot be meaningfully tested in jsdom.** The zoom behavior depends on real DOM dimensions for coordinate math, and its event handling uses raw DOM listeners that don't interact well with jsdom's synthetic event dispatch.

**Mocking d3-zoom makes tests not valuable.** If we mock `useViewport` to return a fixed `{ transform, fitView, screenToCanvas }`, we're testing that our code calls the mock — not that the viewport actually works. The interesting bugs are in the d3↔React interaction (stale transforms, event conflicts, fitView computing wrong bounds), which a mock can't catch.

---

## What CAN Be Tested (and How)

### Tier 1: Pure Functions (Vitest, no DOM)

These are the highest-value tests because they verify core logic without any DOM dependency.

| Function | File | What to Test |
|----------|------|-------------|
| `getHandlePosition()` | LayoutMap.tsx | All 9 compass positions compute correctly for given node rect |
| `isValidConnection()` | LayoutMap.tsx | Self-loop rejection, valid handles, invalid handles |
| Organizer filtering | LayoutMap.tsx | Top-level organizers, wagons, non-eligible nodes |
| Edge label generation | LayoutMap.tsx | Constraint → edge label formatting |
| `screenToCanvas()` | useViewport.ts | Math is correct for given transform (can test the formula directly) |

These can be extracted into standalone functions (some already are) and tested with zero mocking.

**Estimated**: 15-20 test cases, ~150 lines. High confidence, zero flakiness.

### Tier 2: Component Rendering (Vitest + jsdom + Testing Library)

Test that components render correctly given props. No d3, no interactions.

| Component | What to Test |
|-----------|-------------|
| `ConnectionHandle` | Renders with data attributes for target type, fires `onStartConnection` for source type, `stopPropagation` behavior |
| `LayoutMapOrganizerNode` | Renders name, color, 8 handles, drag handle bar |
| `LayoutMap` (shallow) | Renders header, close button, test layout button. Mock `useViewport` to return identity transform, mock `useNodes` to return test organizers. Verify nodes/edges appear in the DOM. |

**The `useViewport` mock for rendering tests**: Return `{ transform: { x: 0, y: 0, k: 1 }, containerRef: { current: null }, fitView: vi.fn(), screenToCanvas: vi.fn() }`. This is legitimate for rendering tests — we're testing that the component passes the transform to CSS and renders nodes at positions, not that d3-zoom works.

**Estimated**: 10-15 test cases, ~200 lines. Medium confidence — tests the rendering pipeline, not interactions.

### Tier 3: Hook Logic (Vitest + renderHook)

Test the state machine logic in hooks, with d3 mocked out.

| Hook | What to Test |
|------|-------------|
| `useConnectionDrag` | `startConnection` sets state, `pointermove` updates coordinates, `pointerup` on target calls `onConnect`, `pointerup` on empty clears state, validation rejects invalid connections |
| `useViewport` (partial) | Transform state updates, `screenToCanvas` math. **Skip fitView** — depends on real DOM dimensions. |

**For `useConnectionDrag` tests**: The hook uses `document.elementsFromPoint()` for hit-testing, which jsdom doesn't implement well. Two options:
1. Mock `document.elementsFromPoint` to return an element with the right data attributes → tests the hit-test logic
2. Accept that hit-testing is an E2E concern and only test the state transitions

Option 1 is reasonable and catches real bugs (wrong attribute names, missing data attributes).

**Estimated**: 8-12 test cases, ~150 lines.

### Tier 4: E2E (Playwright — real browser)

This is where d3-zoom, drag, connections, and viewport are actually tested. Playwright runs a real Chromium instance with real DOM dimensions and real events.

| Scenario | What to Test |
|----------|-------------|
| Open LayoutMap | Gold button visible, click opens overlay, organizers render |
| Pan & zoom | Mouse wheel changes viewport, drag on empty space pans |
| Drag node | Drag handle moves organizer, position updates visually |
| Create connection | Drag from compass handle to another organizer body creates constraint |
| Delete constraint | Right-click edge → context menu → delete removes it |
| Test Layout | Click button → positions resolve according to constraints |
| Close | Button returns to main canvas, canvas unaffected |
| Comparison | LayoutMap and LayoutView produce same visual result for same data |

**E2E test structure** (matches existing pattern — see `organizers.spec.ts`):

```typescript
test.describe('LayoutMap', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?seed=kitchen-sink');
    // Wait for page to load
    await page.getByTestId('settings-menu-button').waitFor({ state: 'visible', timeout: 15000 });
  });

  test('opens via gold button and renders organizers', async ({ page }) => {
    // Click gold button (Layout Map)
    await page.locator('button[title="Layout Map (experimental)"]').click();
    // Verify header
    await expect(page.locator('text=Layout Map')).toBeVisible();
    // Verify organizers render (check for organizer name text)
    await expect(page.locator('.layout-map-organizer')).toHaveCount.above(0);
  });

  test('drag organizer updates position', async ({ page }) => {
    await page.locator('button[title="Layout Map (experimental)"]').click();
    const dragHandle = page.locator('.drag-handle').first();
    const box = await dragHandle.boundingBox();
    // Drag 100px right
    await dragHandle.dragTo(page.locator('.drag-handle').first(), {
      sourcePosition: { x: box!.width / 2, y: box!.height / 2 },
      targetPosition: { x: box!.width / 2 + 100, y: box!.height / 2 },
    });
    // Verify position changed (check CSS left/top of parent div)
  });
});
```

**Estimated**: 8-10 test cases, ~200 lines. Highest confidence — tests real user interactions in a real browser.

---

## What NOT to Test

1. **d3-zoom's zoom math** — it's a battle-tested library with its own test suite. Don't re-test that `scaleExtent` clamps correctly.

2. **fitView with mocked dimensions** — `fitView` computes from `getBoundingClientRect()`. If we mock the rect, we're testing arithmetic, not the feature. Leave this to E2E.

3. **CSS transforms** — Verifying that `transform: translate(50px, 50px) scale(0.5)` visually moves elements is a browser concern. E2E covers this.

4. **SVG rendering** — jsdom can check that SVG elements exist in the DOM, but can't verify they're visually correct. E2E or manual testing.

5. **Pinch-to-zoom** — Even Playwright can't easily simulate multi-touch. Manual testing only.

---

## Recommended Test Plan

### Phase 1 (with LayoutMap)

| Tier | Tests | Coverage | Effort |
|------|-------|----------|--------|
| Pure functions | `getHandlePosition`, `isValidConnection`, organizer filtering | Core geometry & validation | Low |
| Components | `ConnectionHandle`, `LayoutMapOrganizerNode` | Rendering correctness | Low |
| E2E | Open, drag, connect, delete, close | Full user flow | Medium |

### Phase 2 (with Metamap migration)

| Tier | Tests | Coverage | Effort |
|------|-------|----------|--------|
| Hook logic | `useConnectionDrag` state machine | Connection creation flow | Low |
| E2E | Metamap-specific: schema drag, connect, select | Phase 2 user flows | Medium |

### Phase 3 (with Map migration)

| Tier | Tests | Coverage | Effort |
|------|-------|----------|--------|
| Hook logic | `useSelection` lasso, `useViewport` screenToCanvas | Selection & coordinate math | Low |
| E2E | Full Map: drag persistence, resize, selection, layout actions | Regression suite | High |

---

## The Integration Gap

There's a gap between pure-function tests and E2E: **hook integration tests that exercise the d3↔React boundary**. These would test:
- d3-zoom event → `setTransform` → React re-render → CSS updates
- Drag start → pointer events → state update → position change
- Connection drag → hit-test → `onConnect` callback

These are the most interesting tests but also the hardest to write in jsdom. Two options:

### Option A: Accept the gap
Pure functions catch logic bugs, E2E catches interaction bugs. The gap (d3↔React integration) is covered by E2E with Playwright. This is pragmatic and matches the existing test philosophy ("integration over unit, but E2E for real interactions").

### Option B: Use Playwright component testing
Playwright has experimental [component testing](https://playwright.dev/docs/test-components) that renders React components in a real browser. This would let us test `useViewport` with real DOM dimensions without a full app server. Adds complexity but fills the gap.

**Recommendation: Option A.** The gap is narrow — pure functions + E2E covers >90% of bugs. The d3↔React boundary is simple enough (one `useEffect`, one `useState`) that visual smoke testing catches issues. Option B is worth exploring if Phase 3 reveals integration bugs that E2E is too slow to catch.

---

## Summary

| Layer | Tool | d3 Dependency | Value |
|-------|------|--------------|-------|
| Pure functions | Vitest | None | HIGH — catches geometry/validation bugs |
| Component rendering | Vitest + jsdom | Mock `useViewport` | MEDIUM — catches rendering regressions |
| Hook state machines | Vitest + renderHook | Mock `document.elementsFromPoint` | MEDIUM — catches connection logic bugs |
| Full interactions | Playwright E2E | Real browser, real d3 | HIGH — catches integration bugs |
| d3 internals | N/A | N/A | NONE — don't test libraries |

**Bottom line**: d3-zoom makes jsdom-based interaction testing impractical, but that's fine. Extract pure logic, test it directly. Test interactions in E2E. The canvas engine's testable surface is the functions it exposes, not the d3 plumbing underneath.
