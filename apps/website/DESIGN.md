# Earthworm Website design baseline

## Existing identity

The incumbent identity is warm and editorial: rice-paper cream surfaces, dark aubergine text, a restrained violet accent, Chinese serif display headings and compact monospaced learning details. The Earthworm wordmark and existing course content remain the visual authority.

## Interface modes

- **Persuade** — home and course discovery use one strong editorial headline, concise proof points and a clear continuation action. Decoration stays subordinate to course choice.
- **Operate** — catalog, search, account, records and reset screens prioritize labels, state, feedback, predictable controls and scanability.
- **Experience** — practice uses the full available viewport, brings the prompt and answer together, and keeps completion/navigation controls stable without page scrolling.

## Foundation

- Background: warm paper `#f7f3ed`; primary surface `#fffdf9`.
- Text: ink `#201a2b`; secondary text `#6f6879`.
- Brand: violet `#7553d8`; strong violet `#51349f`.
- Semantic success, warning and error colors must include text or icons, not color alone.
- Display type: Georgia / Songti SC; interface type: system sans; word practice: system monospace.
- Spacing follows a 4px base. Common control height is 40px desktop and at least 44px touch.
- Radius is restrained: 8px controls, 12–16px content surfaces, larger radii only for major modal/sheet containers.
- Shadows express elevation only. Ordinary cards use borders and subtle surface contrast.

## Responsive behavior

- Desktop may use wide grids and persistent shortcuts.
- Tablet collapses course grids and header navigation before horizontal scrolling is allowed.
- Mobile keeps header actions on one row, uses bottom-safe actions, avoids hover-only affordances and adapts to the visual viewport when the soft keyboard opens.
- Practice is task-reflowed rather than uniformly scaled: prompt/input are enlarged while secondary shortcuts and preference controls are reduced or moved out of the way.

## Interaction and accessibility

- Every interactive element has a visible `:focus-visible` state.
- Dialogs identify their title, close with Escape, restore focus and prevent background scrolling.
- Icon-only controls have accessible names. Status is never communicated only by color.
- Motion is functional, short and disabled under `prefers-reduced-motion`.
- Empty, loading, error, success and long-content states remain within their containers without horizontal overflow.
