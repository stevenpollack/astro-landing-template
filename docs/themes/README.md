# Theme switcher — preview gallery

Proof that the floating theme switcher re-skins the whole page (palette + typography +
shape) live. Each theme is a `[data-theme]` block in `src/styles/themes.css`; the choice is
saved to `localStorage` (no cookies) and re-applied before paint. Screenshots are generated
from the real running site.

## The switcher

| Desktop popover | Mobile bottom sheet |
| :-- | :-- |
| ![Switcher popover, default theme](./switcher-open.png) | ![Switcher bottom sheet on mobile, Noir theme](./switcher-mobile.png) |

Each swatch renders in its **own** theme (note Editorial's serif "Aa", Mono's grotesk) via a
nested `data-theme` — no colours are duplicated in JS.

## Themes

### Studio (default)
![Studio theme](./theme-default.png)

### Terracotta — warm earthy serif
![Terracotta theme](./theme-terracotta.png)

### Noir — dark, high-contrast
![Noir theme](./theme-noir.png)

### Ocean — cool blue, airy
![Ocean theme](./theme-ocean.png)

### Editorial — classic magazine serif
![Editorial theme](./theme-editorial.png)

### Mono — brutalist / technical
![Mono theme](./theme-mono.png)
