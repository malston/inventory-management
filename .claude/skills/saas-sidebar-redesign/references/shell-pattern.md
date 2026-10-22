# Shell pattern

Markup and CSS recipe for the sidebar shell. Adapt names to the app; keep the structure. Replace `NavLinks`, `FilterBar`, `LanguageSwitcher`, `ProfileMenu` with whatever the app actually has, moved over with their existing props and event bindings.

## Markup

```html
<div class="app-shell" :class="{ 'nav-open': navOpen }">
  <aside class="sidebar" aria-label="Main navigation">
    <div class="sidebar-brand">
      <!-- existing logo / app name markup, moved as-is -->
    </div>
    <nav class="sidebar-nav">
      <!-- existing router-links, one per line, same :to, labels and active binding -->
      <router-link
        to="/"
        class="sidebar-link"
        :class="{ active: $route.path === '/' }"
      >
        <svg class="sidebar-icon" aria-hidden="true" viewBox="0 0 20 20">
          <!-- optional inline icon -->
        </svg>
        <span>{{ t('nav.overview') }}</span>
      </router-link>
    </nav>
    <div class="sidebar-footer">
      <!-- optional: language switcher or version -->
    </div>
  </aside>

  <div class="sidebar-backdrop" @click="navOpen = false"></div>

  <div class="app-main">
    <header class="topbar">
      <button
        class="topbar-menu"
        type="button"
        aria-label="Open navigation"
        @click="navOpen = true"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20">
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>
      <div class="topbar-controls"><!-- filter bar if compact --></div>
      <div class="topbar-actions"><!-- language switcher, profile menu --></div>
    </header>
    <!-- wide filter bar goes here instead, full width under the top bar -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</div>
<!-- modals stay outside .app-shell, unchanged -->
```

Add `navOpen` as a `ref(false)` in the root component's script, in the same style the file already uses, and close it on navigation:

```js
const navOpen = ref(false);
const route = useRoute();
watch(
  () => route.fullPath,
  () => {
    navOpen.value = false;
  },
);
```

With an Options API root, use `data()` and a `$route` watcher instead.

## CSS

```css
.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  min-height: 100vh;
  background: var(--color-bg);
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-6) var(--space-4);
  background: var(--color-sidebar-bg);
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--color-sidebar-text);
  font-size: var(--text-sm);
  font-weight: 500;
  text-decoration: none;
}
.sidebar-link:hover {
  background: var(--color-sidebar-hover);
  color: var(--color-sidebar-text-strong);
}
.sidebar-link.active {
  background: var(--color-sidebar-active-bg);
  color: var(--color-sidebar-active-text);
}
.sidebar-icon {
  width: 18px;
  height: 18px;
  flex: none;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.6;
}

.sidebar-footer {
  margin-top: auto;
}

.app-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: var(--topbar-height);
  padding: 0 var(--space-6);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}
.topbar-controls {
  flex: 1;
  min-width: 0;
}
.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.topbar-menu {
  display: none;
}

.main-content {
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
}

.sidebar-backdrop {
  display: none;
}

:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

@media (max-width: 900px) {
  .app-shell {
    grid-template-columns: minmax(0, 1fr);
  }
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 40;
    width: var(--sidebar-width);
    transform: translateX(-100%);
    transition: transform 200ms ease;
  }
  .nav-open .sidebar {
    transform: translateX(0);
  }
  .nav-open .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 30;
    background: var(--color-backdrop);
  }
  .topbar-menu {
    display: inline-flex;
    padding: var(--space-2);
    border: 0;
    background: none;
    color: var(--color-text);
    cursor: pointer;
  }
  .topbar-menu svg {
    width: 20px;
    height: 20px;
    stroke: currentColor;
    stroke-width: 1.8;
  }
  .main-content {
    padding: var(--space-6) var(--space-4);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar {
    transition: none;
  }
}
```

## Common mistakes

- **Forgetting `min-width: 0`** on `.app-main` or grid children. Wide tables then push the page wider than the screen.
- **Rewriting moved components.** Move the tag with its attributes; don't re-implement the profile menu or filter bar.
- **Breaking the old layout rules.** Old selectors such as `.top-nav`, `.nav-container`, `.nav-tabs` become dead once the markup changes. Delete them rather than leaving them to collide with the new rules.
- **Dark sidebar with unreadable icons.** If the sidebar uses a dark token, set icon stroke to `currentColor` so it follows the link color.
