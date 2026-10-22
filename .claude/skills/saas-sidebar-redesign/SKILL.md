---
name: saas-sidebar-redesign
description: Redesigns a Vue 3 app's shell into a modern SaaS-style layout -- a vertical navigation sidebar on the left in place of a top nav bar, a slim top bar for filters and account controls, one spacing scale, and polished global styles driven by CSS custom properties. Use this skill when someone wants the whole Vue app's layout redesigned: moving navigation into a sidebar or side nav, making the app as a whole look modern, professional or "like a real SaaS product", or replacing a top nav or header that looks dated or cluttered. It applies even if they never say the word "sidebar". Do not use it for narrow styling fixes to one view, table, card or component (for example "the spacing on the Orders table feels off" or "make this button blue"). Those need a targeted edit, not a new shell.
---

# SaaS Sidebar Redesign

Turn a Vue 3 app with a top navigation bar into a SaaS-style shell: a fixed left sidebar for navigation, a slim top bar for page-level controls, and a content area whose cards, tables and badges share one set of design tokens.

The redesign changes the **shell and the global styles**. Views keep their markup and scripts. They pick up the new look because their shared classes (cards, tables, badges, page headers) are restyled through tokens. The one exception is a narrow-width CSS fix inside a view's `<style>` block (section 5). This keeps the diff reviewable and keeps the risk of breaking page logic near zero.

## 1. Discover before you design

Read the app before writing anything. You need these facts, and guessing any of them is how redesigns break things:

- **The root layout.** Usually `src/App.vue`; sometimes a `layouts/` component wrapped around `<router-view>`. Find where the nav lives.
- **Everything in the header.** List each element in the current top bar besides nav links: logo/app name, language switcher, profile menu, global filter bar, search, notifications. Each one needs a new home (see the placement table in section 3).
- **The nav links.** Every `router-link` target, its label, and how the label is produced. If labels go through an i18n call such as `t('nav.inventory')`, keep those exact calls. Hard-coded labels stay hard-coded; translating them is out of scope.
- **Active-link logic.** Note how the current link is marked (`:class="{ active: ... }"`, `router-link-active`, `exact-active-class`). Carry the same logic over.
- **Where global styles live.** An unscoped `<style>` in `App.vue`, a `main.css`/`style.css` imported in `main.js`, or a Tailwind setup. Find the shared classes views rely on (grep `src/views` for class names and check which are defined globally).
- **Existing design system.** Check the project's `CLAUDE.md` (look for a "Design System" or style section), any existing CSS custom properties, and the colors already in use. Note any rules such as "no emojis in UI".
- **Component style in use.** `<script setup>` vs `setup()` vs Options API. Match what the root component already uses.
- **Project rules about who edits `.vue` files.** If the project's `CLAUDE.md` requires a specific subagent for `.vue` changes, follow it: do the discovery and planning here, then hand the agent the plan from sections 2-4 as its spec.

Write a short inventory of what you found (header contents, nav links, style location, token source) before moving on. It doubles as the checklist for verification.

## 2. Settle the tokens

Tokens go on `:root` as CSS custom properties in the global stylesheet, so every view inherits them without edits.

**Use the project's design system first.** If `CLAUDE.md` or existing CSS defines colors, keep those exact values and name them as tokens. Only fill gaps (for example, a sidebar background or a focus ring) with values that sit in the same palette family.

**Fall back to `references/tokens.md`** only when the project has no design system at all. It holds a complete neutral SaaS token set and the spacing, radius, shadow and type scales.

Whichever source you use, define one **spacing scale** (4px base: 4, 8, 12, 16, 24, 32, 48) and use only those values for padding, margin and gap in the CSS you write. Inconsistent spacing is the most visible difference between an amateur and a professional UI, so this is where most of the polish comes from.

## 3. Build the shell

Read `references/shell-pattern.md` for the markup and CSS recipe. The structure is:

```text
+----------+--------------------------------------+
| Sidebar  | Top bar (page controls, account)     |
| logo     +--------------------------------------+
| nav      | Main content (<router-view>)         |
| ...      |                                      |
| footer   |                                      |
+----------+--------------------------------------+
```

Placement of existing header elements:

| Element                | New home                              | Why                                                |
| ---------------------- | ------------------------------------- | -------------------------------------------------- |
| Logo / app name        | Sidebar top                           | Anchors the nav and frees the top bar              |
| Nav links              | Sidebar, vertical list                | The point of the redesign                          |
| Global filter bar      | Top bar, or directly under it if wide | Filters act on the page, so they sit with the page |
| Language switcher      | Top bar right, or sidebar footer      | Keep it one click away                             |
| Profile / account menu | Top bar right                         | Conventional SaaS position users look for          |
| Search, notifications  | Top bar                               | Page-level actions                                 |

Preserve behavior exactly:

- Keep every `router-link` target, label expression and active-link binding.
- Keep every event binding and prop on moved components (for example `@show-profile-details="..."`). Moving a component is a cut and paste of its tag, never a rewrite.
- Keep modals, toasts and other root-level components where they are, outside the shell grid.
- Do not add dependencies. Icons, if you add them, are inline SVG; never emoji.
- Do not touch the `<template>` or `<script>` of files under `src/views/`. If a view looks wrong after the change, fix it through the global classes or tokens. The only view edits allowed are the narrow-width CSS fixes in section 5.

## 4. Restyle the shared classes

Rewrite the existing global rules (cards, stat cards, tables, badges, page headers, buttons, form controls) to use the tokens and the spacing scale. Keep the class names; views depend on them. Aim for:

- Cards: surface background, 1px border, small radius, little or no shadow. Shadow on everything flattens hierarchy.
- Tables: muted uppercase header row with letter-spacing, comfortable row height, subtle hover, `font-variant-numeric: tabular-nums` on numbers.
- Badges: keep the existing status meaning and colors (success/warning/danger/info); only tune size, radius and weight.
- Page headers: clear title size step over card titles, muted subtitle, consistent space below.
- Focus: a visible `:focus-visible` ring on links, buttons and form controls.

## 5. Responsive behavior

- Desktop: sidebar fixed at about 240px wide; content scrolls independently.
- Below about 900px: the sidebar becomes an off-canvas drawer opened by a menu button in the top bar, with a backdrop that closes it. Close it on route change.
- The page body never scrolls horizontally. Wide tables scroll inside their own container (`overflow-x: auto`).
- Respect `prefers-reduced-motion` for the drawer transition.

### Fix view grids that break at phone width

A new shell often exposes a problem that was already there: views with their own scoped grid rules that never stack. A rule like `grid-template-columns: repeat(2, 1fr)` or `1fr 1fr` with no narrow-width media query keeps two columns at 400px, and its cards run off the screen. A global rule can't reliably fix this, because scoped selectors carry a `[data-v-…]` attribute and win on specificity.

Find these without a browser: in every file under `src/views/`, look in the `<style>` block for multi-column `grid-template-columns` values (`repeat(N, 1fr)` with N ≥ 2, two or more `fr`/fixed tracks) and fixed `width`/`min-width` values over about 360px. A rule is fine if a `@media (max-width: …)` block in the same file already overrides it.

Fix each one by adding a media query at the end of that view's `<style>` block, using the same breakpoint as the sidebar:

```css
@media (max-width: 900px) {
  .charts-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

Rules for these fixes:

- Add CSS only, inside the existing `<style>` block. Never touch the view's template or script, and don't change the view's desktop rules.
- Use `minmax(0, 1fr)` rather than `1fr` so wide content inside a card (an SVG chart, a long label) can't force the column wider than the screen.
- Never hide the overflow instead of fixing it. `overflow: hidden` or `overflow-x: auto` on `.main-content`, `.app-main` or `body` makes the page measure correctly while the content is still cut off or scrolls sideways inside the page.
- List every view you edited, and the rule you added, in your report.

## 6. Verify

Run these before calling the work done, and report the results:

1. `npm run build` (or the project's build script with its package manager) exits 0.
2. Start the dev server and open every route. Each one renders without console errors, and the active link is highlighted in the sidebar.
3. If the app has i18n, switch locale once and confirm the sidebar labels change.
4. Check one narrow width (about 400px): the drawer opens and closes, and nothing scrolls sideways. With a browser tool, run this in the page; it should return an empty list:
   ```js
   [...document.querySelectorAll("body *")]
     .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
     .map((el) => el.className)
     .slice(0, 10);
   ```
5. `git diff --stat` shows changes only in the root layout, global styles, any new shell component, and the views you fixed in section 5. No `package.json` changes. For each changed view, `git diff` shows lines added only inside its `<style>` block.

Take a screenshot of the main route at desktop and phone widths if a browser tool is available, so the user can see the result.

## Report back

Tell the user, briefly: where each former header element went, which token source you used (project or fallback), the verification results from section 6, each view you gave a narrow-width CSS fix, and anything you deliberately left alone (for example, hard-coded labels or view-level styling that would need its own pass).
