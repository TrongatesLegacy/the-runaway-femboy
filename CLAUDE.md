# The Runaway Femboy

Fan-made browser runner for the VTuber AstrayVT. Vite + TypeScript + Canvas 2D. All art is drawn procedurally in
`src/art/`, and all audio is CC0 in `public/audio/` (credits are in `public/audio/CREDITS.md`). See `README.md` for
the controls, hosting and the test scripts in `test/`.

## Git and GitHub

- The repo is `TrongatesLegacy/the-runaway-femboy`. Commits use TrongatesLegacy with the noreply email
  (`273253984+TrongatesLegacy@users.noreply.github.com`). This is set in this repo's `.git/config` and by
  `~/.gitconfig-trongates`. Never commit under another identity.
- **No AI credit in commits or pull requests:** no `Co-Authored-By: Claude` (or any Claude/Anthropic) trailer and no
  "Generated with" line.
- `gh` here needs `GH_TOKEN="$(gh auth token --user TrongatesLegacy)"`. Never run `gh auth switch`, because the
  machine's global identity is the owner's work account.

## Working on it

- `npm run dev` serves the game on :5199. Run `npm run typecheck` before committing.
- For visual changes, check `node test/shoot.mjs` (screenshots at desktop and phone sizes). For gameplay changes, run
  `node test/playtest.mjs 3` (bot runs; every run should still be winnable).
- Keep the content non-sexual: Astray is a real streamer.
