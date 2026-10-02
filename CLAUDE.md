# CLAUDE.md

- Plain HTML, CSS, and JS with no build step, no framework, no dependencies.
- All colors, fonts, and grid spacing are design tokens at the top of `styles.css`, section 1. Change them there, never hardcode a color.
- The nav and footer are duplicated across all seven pages, so changes to them must be applied in each one.
- Nav panel wording lives in the `COPY` object in `navpanel.js`.
- Page-specific CSS belongs in that page's `<style>` block; only shared styles go in `styles.css`.
- Post files sit one folder deep and link to `../styles.css`; games will be two deep and use `../../`.
