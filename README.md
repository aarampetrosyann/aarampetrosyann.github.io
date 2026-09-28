# aarampetrosyann.github.io

My personal site: background, projects, games, and writing.

Live at [aarampetrosyann.github.io](https://aarampetrosyann.github.io)

## Structure

```
index.html      home
games.html      list of games
blog.html       list of posts
404.html        not found page
styles.css      all styling, shared by every page
scramble.js     nav hover effect, shared by every page
posts/          one file per blog post
games/          one folder per game
```

## Editing

Plain HTML and CSS with no build step. Open any file in an editor,
or open `index.html` in a browser to see changes immediately.

- Colors and fonts are the design tokens at the top of `styles.css`
- Each section of `index.html` is a labeled block with a template comment
- New post: copy a file in `posts/`, then link it from `blog.html`
- New game: add a folder under `games/`, then link it from `games.html`

## Deploying

Hosted on GitHub Pages from the `main` branch. Any push to `main`
redeploys automatically within a minute.
