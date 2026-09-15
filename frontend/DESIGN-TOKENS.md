# Design tokens

## Use roles, not colours

```tsx
<div className="bg-surface text-content border-line" />   // yes
<div className="bg-white text-black border-navy/15" />    // no
```

`bg-beige` hardcodes a decision that a dark theme has to undo in every file that
made it. `bg-surface-sunk` is that decision made once, in `globals.css`.

| Role | Use for |
|---|---|
| `surface` | The page background |
| `surface-raised` | Cards and panels that sit above the page |
| `surface-sunk` | Recessed or tinted sections |
| `content` | Body text |
| `content-muted` | Captions, hints, secondary text |
| `accent` | Headings, buttons, links — the brand navy |
| `accent-contrast` | Text placed **on** an accent background |
| `line` | Borders and dividers |

## Dark mode

Defined, not shipped. `globals.css` carries a complete dark palette under
`prefers-color-scheme: dark`, plus a `[data-theme]` override so an explicit
choice wins in either direction.

Turning it on is adding a toggle that sets `data-theme` — **no component CSS
changes**, provided components use roles.

It is deliberately not an inversion. The navy is lifted so it stays legible on a
dark ground, and the neutrals keep a hint of the brand's warmth rather than
going flat grey.

## Migrating a component

The existing components still use raw colours; that is fine and they keep
working. When you touch one, swap what you are already editing:

| From | To |
|---|---|
| `bg-white` | `bg-surface-raised` |
| `bg-beige` | `bg-surface-sunk` |
| `text-navy` | `text-accent` |
| `text-black` | `text-content` |
| `text-navy/70` | `text-content-muted` |
| `border-navy/15` | `border-line` |

Doing it opportunistically rather than as one sweep keeps the diff reviewable
and avoids a large untested change to every screen at once.

## Adding a token

Add the `--color-*` alias in `@theme`, then give `--role-*` a value in **all
three** blocks — bare `:root`, the `prefers-color-scheme` block, and
`[data-theme="dark"]`. A colour defined in only one of them is invisible in the
other theme, which is the classic unreadable-page bug.
