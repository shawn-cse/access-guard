# AccessGuard Architecture

## Purpose

AccessGuard demonstrates a deterministic finite automaton (DFA) approach to multi-step physical access control. Each restricted zone has one exact accepted authentication sequence.

## Frontend layers

### `index.html`

Defines the accessible application shell, overview dashboard, access simulation workspace, audit log, and settings controls.

### `assets/css/styles.css`

Contains the project-specific security console design system, responsive layout, component states, mobile drawer, compact mode, and reduced-motion handling.

### `assets/js/app.js`

Owns the browser application state and interaction flow:

- zone policy definitions
- authentication signal definitions
- live DFA state rendering
- sequence verification
- session statistics
- audit log rendering/export
- optional browser persistence
- keyboard shortcuts
- responsive navigation behaviour

## DFA model

For a required sequence such as:

```text
C → P → F → R
```

AccessGuard visualises states:

```text
q0 → q1 → q2 → q3 → q4
```

`q4` is the accepting state. A wrong transition or an extra/missing signal causes the verification to be denied.

## Data strategy

The frontend has no remote API requirement. Audit history and counters can optionally be stored in browser `localStorage`. Disabling persistence removes saved audit/stat data from local storage.

No credentials are transmitted to any service by the demo.

## Optional Python companion

`backend/dfa_access_control.py` provides a compact Python implementation of the same exact-sequence policy concept for terminal testing and educational comparison.

## Responsive strategy

- Desktop: persistent sidebar + two-panel access workspace
- Tablet: sidebar becomes a drawer; workspace collapses to one column
- Mobile: single-column dashboard with touch-friendly controls

## Deployment

The frontend is static and can be hosted directly on GitHub Pages, Netlify, Cloudflare Pages, or any static web server without a build step.
