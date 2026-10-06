# CLAUDE.md

- Plain HTML, CSS, and JS with no build step, no framework, no dependencies.
- All colors, fonts, and grid spacing are design tokens at the top of `styles.css`, section 1. Change them there, never hardcode a color.
- The nav and footer are duplicated across every page (including the game pages), so changes to them must be applied in each one.
- Nav panel wording lives in the `COPY` object in `navpanel.js`.
- Page-specific CSS belongs in that page's `<style>` block; only shared styles go in `styles.css`.
- Game pages (`games/<game>/index.html`) share their start-screen layout and behavior through `game.css` and `game.js` at the root, which only game pages load. Each game's colors are tokens in `styles.css`, mapped to a card class at the top of `game.css`.
- Game boards share their frame (header, timer, pause, settings pill, Solved window) through `board.css` and `board.js` at the root; each game's own script (e.g. `games/takuzu/takuzu.js`) only draws its squares and plays its rules.
- Post files sit one folder deep and link to `../styles.css`; games will be two deep and use `../../`.
