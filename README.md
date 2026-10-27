# Manager Interview Hub

A planning tool for the Double-A manager interview exercise. Candidates build a month of baseball activities, turn two days of it into detailed practice schedules, and export the result for review.

**Monthly calendar → two daily practice schedules → export**

The calendar starts blank. The tool offers optional baseball activity suggestions but never fills anything in, requires a method, or scores the work.

It is a single static HTML file. It needs no backend, login, build step or external services.

## Repository layout

```
index.html                  The application (HTML, CSS and JS in one file)
.nojekyll                   Tells GitHub Pages to serve files as-is
docs/DEVELOPMENT_SUMMARY.md What changed in each version, and why
tests/e2e.js                End-to-end candidate workflow test (Playwright)
tests/fixtures/             Saved V1 and V2 exercises, used to test that old files still open
package.json                `npm test` runs the workflow test
```

## Running it locally

Open `index.html` in a browser. You can also serve the folder:

```
python3 -m http.server 8000     # then visit http://localhost:8000/
```

## How a candidate uses it

1. **Welcome page** (first visit only): the objective, the three-part assignment and a few notes. The candidate enters a name and the planning month, then clicks **Start Planning**. Returning candidates go straight back to their work.
2. **Monthly Planner.**
   - Click any day (or **＋ Add activity**), pick a suggestion or type a custom name, and add an optional time, colour or note.
   - Suggestions are grouped as Team Defense, Offense, Individual / Position Work and Other. Typing filters them, and a suggestion can be renamed before it's added.
   - Click an activity to edit, duplicate, repeat or delete it. Drag it to move it; hold Alt/Option while dragging to copy.
   - Month priorities and a weekly focus are typed into bands on the calendar.
   - Click a date number to open the day: a label, notes, its activities, and **Build daily schedule**.
3. **Daily Schedule.** This is the V1 builder:
   - rows with time, activity, location and staff (only the activity name matters)
   - an optional details line and colour on each row
   - full, half and one-third width sections for groups or fields
   - stations / rotation grids
   - reordering by drag or keyboard, and "push the rows below" when a time changes
   - the same activity suggestions as the planner

   That day's monthly activities appear at the top; clicking one adds it as a row. **☆ Add to submission** marks the days to submit. The first two schedules are marked automatically.
4. **Export** (one button in the header):
   - **Complete Interview Submission** — one PDF: a cover, the monthly calendar, a week-by-week details page, and the daily schedules checked in the dialog
   - **Monthly Calendar** — PDF
   - **Daily Schedule** — PDF of the chosen day
   - **JSON Backup** — the whole exercise as a file. Import it from the Export dialog or the welcome page.

The **?** button in the header opens the instructions from either workspace.

## Saving and safeguards

- **Autosave.** Every change saves to the browser's `localStorage`. This does **not** sync between devices or browsers, which the welcome page and the help both say.
- **Undo/redo.** Ctrl/⌘ Z undoes any change; Ctrl/⌘ Shift Z (or Ctrl/⌘ Y) redoes it.
- **Recovery.** A one-step backup is kept when an exercise is replaced (*Export → Restore previous*).
- **Warnings.** A banner appears if browser storage is blocked or full. Saving pauses in a tab if the same exercise is edited in another tab.
- **Shared computers.** Use *Export → Start a new exercise* between candidates. It offers to download a backup first.

## Preparing a link for candidates

A fresh workspace can be preset from the URL:

```
https://cristianxperez-dev.github.io/manager-sandbox/?month=2027-06&label=Double-A%20Manager%20Interview
```

These parameters only apply to a blank workspace. They never overwrite work in progress.

## GitHub Pages

The site is published from `main` at **https://cristianxperez-dev.github.io/manager-sandbox/**. Pages serves whatever is on `main`, so merging a change into `main` updates the live site within a minute or two. Work on a branch first and merge only when you want candidates to see it.

To set Pages up from scratch: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.

Notes:

- **Indexing.** `index.html` includes `noindex, nofollow`, so search engines are asked not to list it.
- **Storage keys.** All Pages project sites under one account share an origin (`cristianxperez-dev.github.io`). Storage keys are namespaced (`mis:v1:*`) to avoid collisions with other tools hosted there.
- **Other tools.** Further tools can live in their own folders without changing this URL.

## Testing

The workflow test needs Node 18+ and Playwright with Chromium:

```
npm install --no-save playwright && npx playwright install chromium   # first time only
npm test                     # or: SHOTS=1 node tests/e2e.js  (also saves screenshots)
```

It serves the repository at a Pages-like subpath and drives the whole exercise:

- welcome page → Start Planning
- adding activities from suggestions and as custom entries, filtering, renaming
- editing, repeating, duplicating, deleting, undoing, moving and Alt-copying activities
- the day panel
- three daily schedules (keyboard entry, suggestions, planned-activity strip, time-shift, sections, rotation grid, row drag) and choosing two for submission
- the help modal
- reload persistence
- the four exports, including PDF page counts
- JSON backup → new exercise → import
- rejecting bad or malicious files
- opening real V1 and V2 saves
- the two-tab warning
- a click-every-button sweep
- tablet width

It also confirms the removed evaluation interface is gone. It fails on any page error or external network request. Output goes to the git-ignored `tests/output/`.

## Confidentiality

This build contains no player names, staff names, internal schedules, organization-specific data or credentials. It makes no network requests. Everything a candidate enters stays in their own browser until they export it.
