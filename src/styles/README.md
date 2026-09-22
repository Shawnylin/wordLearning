# Stylesheet structure

`main.css` is the only entry imported by the application. Its `@import` order intentionally follows the former monolithic stylesheet; do not alphabetize it or regroup later overrides ahead of earlier rules.

| File | Responsibility |
| --- | --- |
| `tokens.css` | New, scoped dimension and feedback-duration variables; no color changes |
| `liquid-toggle.css` | Liquid toggle states and keyframes |
| `word-command.css` | Word command field, action and liquid motion |
| `theme.css` | Existing color palettes, dark variant, Tailwind theme mappings and fonts |
| `base.css` | Document/app scrolling, paper texture, app-update motion and global color transitions |
| `primitives.css` | Cards, seals, buttons, safe-area bottom reservation, scrollbars and basic entrance animations |
| `effects.css` | Glass surfaces, their theme variables, list motion and reduced-motion override |
| `study.css` | Study reading layout and container query |
| `layout.css` | Tablet navigation reservation and existing shared responsive layout overrides |
| `profile.css` | Profile hub, identity card, rows and settings controls |
| `profile-sync.css` | Cloud-sync panel and feedback |
| `profile-account.css` | Account editor and form |
| `profile-responsive.css` | Existing profile media queries, in their original order |

Some responsibilities intentionally span files: glass variables stay next to their later surface rules; safe-area reservation stays among primitives; tablet study/settings overrides stay in `layout.css`. Moving them into earlier files would change the original cascade. Component-scoped styles and navigation components are untouched.

## First-stage tokens

These are ordinary custom properties, not Tailwind `@theme` scale overrides. They only affect declarations explicitly using them.

| Token | Value | Scope |
| --- | --- | --- |
| `--word-command-control-size` | `56px` | Command field and circular action dimensions |
| `--word-command-field-radius` | `28px` | Command field/body radius |
| `--study-section-gap` | `24px` | Study heading spacing and section spacing |
| `--profile-section-gap` | `18px` | Profile section separation |
| `--profile-section-padding-inline` | `18px` | Profile section/identity horizontal padding |
| `--profile-inline-gap` | `12px` | Profile inline content spacing |
| `--profile-layout-gap` | `20px` | Profile page/grid spacing |
| `--profile-control-size` | `40px` | Profile compact action height and icon-button dimensions |
| `--profile-option-height` | `42px` | Profile option controls; excludes the same-height page heading |
| `--profile-field-height` | `44px` | Profile form fields and standard actions |
| `--profile-control-radius` | `10px` | Profile compact controls and feedback |
| `--profile-action-radius` | `11px` | Profile sync/save action radius |
| `--motion-feedback-duration` | `180ms` | Existing liquid-toggle/profile feedback transitions |

This is not a global spacing scale. Keep unrelated equal numbers independent. Breakpoints, navigation sizes, colors, card radii, unique motion durations and component-local dimensions remain literal. Do not replace more values solely because they match a token numerically.

## Visual comparison

With the development server on port 5173 and `CODEX_NODE_MODULES` pointing to the available Playwright installation:

```sh
node tests/css-visual.mjs before
# Make the CSS change.
node tests/css-visual.mjs after
```

The script uses mock data and network responses, captures 36 views at 320/393/820/1440px, and compares computed geometry/styles. Artifacts are written to ignored `docs/.local/css-refactor/`. Compare the matching before/after PNGs as well; reduced-motion captures check settled layouts, not intermediate animation frames. Capture a fresh baseline before each later change.
