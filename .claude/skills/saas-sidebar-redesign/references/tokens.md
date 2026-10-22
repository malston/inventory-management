# Tokens

Two parts: the **structural scales** every redesign uses, and a **fallback palette** used only when the project has no design system.

## Structural scales (always use)

```css
:root {
  /* spacing, 4px base */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  /* radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;

  /* type */
  --font-sans:
    system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 0.9375rem;
  --text-lg: 1.125rem;
  --text-xl: 1.5rem;

  /* shadow: use sparingly, for floating layers (menus, modals) */
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
  --shadow-lg: 0 10px 30px rgba(15, 23, 42, 0.12);

  /* layout */
  --sidebar-width: 240px;
  --topbar-height: 56px;
  --content-max-width: 1400px;
}
```

If the project already loads a font, use it for `--font-sans` instead. Don't add a font import the project didn't have.

## Mapping a project palette

When the project defines colors, map them onto these token names so the shell CSS in `shell-pattern.md` works unchanged:

| Token                                                                  | Role                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------- |
| `--color-bg`                                                           | Page background behind cards                      |
| `--color-surface`                                                      | Cards, top bar, tables                            |
| `--color-border`                                                       | Hairlines and card borders                        |
| `--color-text`                                                         | Body text                                         |
| `--color-text-muted`                                                   | Labels, subtitles, table headers                  |
| `--color-sidebar-bg`                                                   | Sidebar background                                |
| `--color-sidebar-text`                                                 | Sidebar link text                                 |
| `--color-sidebar-text-strong`                                          | Sidebar link hover text                           |
| `--color-sidebar-hover`                                                | Sidebar link hover fill                           |
| `--color-sidebar-active-bg`                                            | Active link fill                                  |
| `--color-sidebar-active-text`                                          | Active link text                                  |
| `--color-accent`                                                       | Primary buttons, links                            |
| `--color-focus`                                                        | Focus ring                                        |
| `--color-backdrop`                                                     | Drawer backdrop                                   |
| `--color-success`, `--color-warning`, `--color-danger`, `--color-info` | Status; keep the project's existing status colors |

Example: a project whose design system says "Slate/gray (#0f172a, #64748b, #e2e8f0)" maps `#0f172a` to `--color-text` (and optionally `--color-sidebar-bg` for a dark sidebar), `#64748b` to `--color-text-muted`, and `#e2e8f0` to `--color-border`.

## Fallback palette (only when the project has none)

A light sidebar, cool-neutral palette with one blue accent:

```css
:root {
  --color-bg: #f6f7f9;
  --color-surface: #ffffff;
  --color-border: #e4e7ec;
  --color-text: #101828;
  --color-text-muted: #667085;

  --color-sidebar-bg: #ffffff;
  --color-sidebar-text: #475467;
  --color-sidebar-text-strong: #101828;
  --color-sidebar-hover: #f2f4f7;
  --color-sidebar-active-bg: #eef4ff;
  --color-sidebar-active-text: #2b55d9;

  --color-accent: #2b55d9;
  --color-focus: #6b8cff;
  --color-backdrop: rgba(16, 24, 40, 0.45);

  --color-success: #12b76a;
  --color-warning: #f79009;
  --color-danger: #f04438;
  --color-info: #2e90fa;
}
```
