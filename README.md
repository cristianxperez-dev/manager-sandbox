# Manager Interview Sandbox

A planning workspace for minor league manager interviews. Candidates build a monthly plan for a Double-A affiliate, then turn at least two dates from it into detailed daily practice schedules. Reviewers get a one-page overview and a printable review package.

The tool is deliberately open-ended. It has no preset categories, sample schedule, required fields or scoring. Candidates organize the month their own way.

It is a single static HTML file. It needs no backend, login, build step or external services.

## Repository layout

```
index.html                  The application (HTML, CSS and JS in one file)
.nojekyll                   Tells GitHub Pages to serve files as-is
docs/DEVELOPMENT_SUMMARY.md What was reused, changed, added and left out
tests/e2e.js                End-to-end candidate workflow test (Playwright)
package.json                `npm test` runs the workflow test
```

## Running it locally

Open `index.html` in a browser. You can also serve the folder:

```
python3 -m http.server 8000     # then visit http://localhost:8000/
```

## The candidate workflow

1. **Intro.** The candidate enters their name, an optional exercise label and the planning month.
2. **Monthly Planner.** This is a month view (with a week view) where the candidate can:
   - create their own categories and colours
   - add activities with ＋
   - drag activities to move them (hold Alt/Option to copy)
   - click an activity to edit its time, notes and category, duplicate it, or repeat it
   - type a weekly focus above each week
   - open any day to add a day label, notes and an ordered list of activities
3. **Daily Schedules.** From a day, choose *Build daily schedule*. This uses the Schedule Hub builder: time blocks, activities, details, locations, staff, side-by-side sections, stations/rotation grids, a category on each row, and keyboard shortcuts. The activities planned for that date appear at the top for reference.
4. **Plan Overview.** One page shows priorities, categories, monthly plan entries next to scheduled minutes in the daily schedules, the daily schedules themselves, and the month week by week.

## Saving, exporting and printing

- **Autosave.** Every change saves to the browser's `localStorage` automatically. Browser saving does **not** sync between devices or browsers, and the app says so in the intro and in a banner.
- **Export / Import.** *Save & Export → Export plan (.json)* downloads the whole exercise as one file. *Import* restores it on any machine for further editing.
- **Print / PDF.** You can print the monthly plan (landscape calendar plus a week-by-week details page), any single daily schedule (fitted to one page), or the full **review package**: cover, calendar, details and every daily schedule. To make a PDF, choose "Save as PDF" in the print dialog.
- **Safeguards:**
  - undo/redo (Ctrl/⌘ Z)
  - a one-step backup when an exercise is replaced (*Restore previous exercise*)
  - a warning banner if browser storage is blocked or full
  - saving pauses in a tab when the same exercise is edited in another tab

## Preparing a link for candidates

A fresh workspace can be preset from the URL:

```
https://cristianxperez-dev.github.io/manager-sandbox/?month=2027-06&label=Double-A%20Manager%20Interview
```

These parameters only apply to a blank workspace. They never overwrite a candidate's work in progress.

**Shared computers:** to reset an interview laptop between candidates, use *Save & Export → Start a new exercise*. It offers to export the current plan first.

## Publishing with GitHub Pages

> Nothing has been published. These are the steps to take once you're ready to deploy.

The repository was empty before this work, so there is no existing site or entry point to preserve. `index.html` sits at the root and every reference is relative or inline, so the app works at a project-site subpath.

1. Merge the `claude/sleepy-albattani-k56op0` branch into `main`. You can also publish straight from the branch.
2. On GitHub, open **cristianxperez-dev/manager-sandbox → Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Set **Branch** to `main` and the folder to `/ (root)`, then click **Save**.
5. After a minute or two the site is live at **https://cristianxperez-dev.github.io/manager-sandbox/**. Open it in a private window to confirm you see the intro screen.

Notes:

- **Visibility.** If the repository is private, Pages needs a GitHub plan that supports Pages for private repositories, and the published site is still publicly reachable. `index.html` includes `noindex, nofollow` so search engines are asked not to list it.
- **Storage scope.** All GitHub Pages project sites under one account share an origin (`cristianxperez-dev.github.io`). The app namespaces its storage keys (`mis:v1:*`) so it doesn't collide with other tools later hosted there.
- **Adding more tools later.** Put each new tool in its own folder (for example `/pitching-plan/index.html`). The sandbox URL stays the same. To add a hub landing page later, move the sandbox into `/interview-sandbox/` and replace the root `index.html` with a launcher. Its saved data keeps working because storage is per-origin, not per-path.

## Testing

The workflow test needs Node 18+ and Playwright with Chromium:

```
npm install --no-save playwright && npx playwright install chromium   # first time only
npm test                     # or: SHOTS=1 node tests/e2e.js  (also saves screenshots)
```

It serves the repository at a Pages-like subpath (`/manager-sandbox/`) and drives a full candidate exercise:

- intro
- categories
- quick-add, edit, repeat and duplicate activities
- drag to move and Alt-drag to copy
- the day drawer
- two daily schedules, with keyboard entry, time-shift, sections, a rotation grid and row drag
- the overview
- reload persistence
- printing (it checks PDF page counts)
- JSON export → new exercise → import
- rejection of bad or malicious files
- the two-tab warning
- a sweep that clicks every visible button

It fails on any page error or any external network request. PDFs and screenshots go to `tests/output/`, which is git-ignored.

## Confidentiality

This build contains no player names, staff names, internal schedules, organization-specific data or credentials. It makes no network requests. Everything a candidate enters stays in their own browser until they export it.
