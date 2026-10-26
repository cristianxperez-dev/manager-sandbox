# Development Summary — Manager Interview Sandbox

## V2 — player evaluations and prescriptions

V2 builds on V1 with targeted additions; no V1 feature was removed or redesigned.

**Added**
- **Player Evaluations** section with four fictional Double-A cases (infielder, outfielder, catcher, baserunner). Each case has background, performance figures, scouting and staff observations from several sources (some of which disagree), development context and a player quote. No diagnosis or suggested answer is given.
- **Freeform workspace** for each case: seven open text areas (three for the evaluation, four for the development prescription). There are no dropdowns, rating scales, required fields or preset options.
- **A light player link.** Any monthly activity (activity editor → *Player*) or daily-schedule row (⋯ menu, or the badge on the row) can optionally be linked to one of the four players. Calendar chips show the player's initials; rows show a name badge. Adding a planned activity to a daily schedule keeps its link, and repeating or duplicating an activity copies it.
- **Linked work on each case.** Each case lists the monthly activities and daily rows linked to that player, and each item opens where it lives. There is no tracking, status or progress view.
- **Navigation:** Player Evaluations | Monthly Planner | Daily Schedules. V1's Plan Overview stays as a smaller **Review & Export** link at the right of the tab bar, because it holds the review package and export buttons. New candidates start on Player Evaluations.
- **Intro** rewritten for the four-step exercise (evaluate, prescribe, plan the month, build two days).
- **Printing:** a page per player (case, candidate's writing — blanks shown as "Left blank" — and linked work), available for one player or all four. The review package now runs: cover, four evaluations, calendar, details, daily schedules. The overview and cover page show each player's status and primary priority.

**Preserved:** everything in the V1 sections below — the monthly planner, daily builder, autosave, undo, JSON export/import, prints and safeguards.

**Compatibility:** the data format is now schema 2. It adds an `evals` record keyed by case id (`inf`, `of`, `c`, `br`) and a `playerId` on activities and rows. Schema-1 (V1) files and browser saves load unchanged with blank evaluations. The test suite imports a real V1 export and checks this. Because the cases live in the code rather than in each saved file, editing a case's text later would change how older exports display; give revised cases new ids if that matters.

**Limitations:** an activity or row links to at most one player. A player evaluation prints over one or two pages, depending on how much the candidate writes.

---

## V1

## Starting point

The Astros Manager Hub is a 14,500-line single-file app. Its parts:

- Daily Schedule builder
- Monthly Planner
- Lineup
- Game Day Docs
- Playing Matrix
- Pitching Grid
- Roster, Resources and Games
- AI text builder
- Constraint-solving schedule planner
- Affiliate workspaces

The original file was read but not modified, and it is not in this repository. Nothing from its seed data (player names, staff names or initials, affiliate list, sample schedules or activity library) was carried over.

## What was reused

| From the Schedule Hub | How it lives on in the sandbox |
|---|---|
| Design tokens, navy/orange palette, app bar with tab rail, buttons, toast, menus, modals | Same visual language, re-scoped to three tabs |
| Day card (navy band with title, date, context, notes strip) | The header of every daily schedule |
| Section blocks with coloured headers, ½ and ⅓ widths, row packing shared by build and print | Unchanged in concept. Sections sit side by side when their widths fit, on screen and on paper |
| Row grid: time, activity (+ details line), location, staff; grip; ⋯ menu | Unchanged, plus a category dot per row |
| Time entry (`815` → `8:15`, start + optional end, `815-845`) | Kept, plus AM/PM markers (`7p`) for evening times |
| Time-shift pill ("push the rows below") | Kept: push this section or all sections |
| Keyboard flow: Enter for a new row, ⌘D, ⌥↑↓, ⌥D, ⌘⌫, arrows; paste rows from Excel | Kept |
| Drag to reorder rows and sections | Kept, including dragging rows between sections |
| Monthly calendar, drag activities between days (Alt to copy), "planned today" strip on the builder | Kept and extended |
| Printed sheet style (navy header, angled section tabs, ruled tables, fit-to-one-page) | Rebuilt in a size-relative form that the review package reuses |
| Single-file, no-build architecture; storage wrapper that survives a blocked `localStorage` | Kept. The app keeps working in memory and shows a banner telling the candidate to export |

## What was changed or simplified

- **The Activity Library is gone from the starting state.** The Hub seeded categories (Team Fundamentals, Hitting…) and about 25 activities. Here, categories start empty and the candidate creates, names, colours, reorders and deletes their own. Activities are free text.
- **Month entries are richer.** In the Hub, a day held only references to library items. Here, each entry has a title, category, optional time, notes and date, and can repeat.
- **Weekly focus** strips sit above each calendar week, and each day has a free-text label and notes.
- **Section types were removed** (position / pitcher / rehab routing). Each section has a free-text "Who" line instead.
- **Fixed lists became suggestions.** Location and staff were closed lists tied to the Resources module. Now they're free text. Suggestions come only from what the candidate has already typed, never from a preset list.
- **Row colours** (white, gray, orange, navy emphasis) were replaced by the candidate's own categories. That links daily time back to the monthly plan.
- **Rotations.** The two-group, two-station rotation became a general *Stations / rotation grid*: any number of groups and stations, rotation length, transition time, a live preview, and every cell editable afterwards.
- **Storage** was rescoped from per-affiliate keys to one isolated workspace per exercise, namespaced `mis:v1:*`.

## What's new

- **Intro screen** with the exercise text, name, label and month, plus import or resume.
- **Week view** with larger cards, full notes, and a weekly focus and notes.
- **Day drawer**: label, ordered activities edited inline, notes, *Build / Open daily schedule*, copy the day to another date, clear the day.
- **Activity editor**: category (or create one in place), date, time and notes. You can also:
  - duplicate the activity
  - delete it
  - make it repeat (every weekday, every day, or chosen days, until a date)
  - edit or delete a whole series at once
- **Multiple daily schedules** with tabs, a date picker that shows which days have plans, *Copy layout from another day*, moving a schedule to another date, and delete.
- **Plan Overview**:
  - priorities and approach in the candidate's own words
  - month statistics
  - per category: monthly entries, days, and share, *next to* timed minutes and share in the daily schedules
  - a card for each schedule showing which of that day's planned items appear on it
  - the month week by week
- **Review package**: cover, monthly calendar, week-by-week details, and every daily schedule, in one print or PDF job.
- **Undo/redo** for every change, including typed text.
- **Safeguards**:
  - storage-failure banner
  - multi-tab conflict guard
  - one-step backup when an exercise is replaced
  - "last exported" indicator in the Save & Export menu
- **Validated import** that rejects foreign files and sanitizes text and colours.
- **Preset link** (`?month=2027-06&label=…`) for interviewers.

## What was left out on purpose

These are excluded per the brief:

- Lineup cards, Game Day documents, Playing Matrix, Pitching Grid
- Roster import, Resources, game-schedule CSV import, conflict detection, equipment lists
- The AI text builder and the constraint-solving schedule planner. Both make decisions for the user, which is what the interview is meant to observe.
- Affiliate switching and branding, logos, PNG and WhatsApp export, the leadership-view pivot
- Login, interviewer dashboard, scoring or rubric of any kind. The overview *describes* allocation but never interprets it.

## Technical notes and limitations

- **Single file.** `index.html` holds all HTML, CSS and JS (about 3,500 lines, around 230 KB in V2). There are no dependencies, fonts or network requests. Display type uses the same condensed system font stack as the Hub, with no web-font download.
- **Browser-local storage.** Work lives in one browser on one device. Clearing site data erases it. A candidate who switches machines must export and import. The app says this in three places.
- **Time-of-day inference.** Without an AM/PM marker, hours 1–5 are read as afternoon and 6–11 as morning, the same baseball-day rule as the Hub. Evening times should be typed with `p` (`7:05p`). This only affects calculated durations and sorting. The text always displays as typed.
- **Scheduled time** on the overview counts only rows that have both a start and an end time, grouped by each row's category dot. Untimed rows are listed as not counted.
- **Printing.** The standalone monthly plan prints landscape. In the review package the calendar prints portrait, because browsers handle mixed page orientation inconsistently in one job. Daily sheets shrink (or grow, up to 130%) to fit one page.
- **Browser support.** Tested in Chromium (desktop 1440 px and tablet 1024 px). The app uses standard APIs only, including `color-mix()`, so it needs current Chrome, Edge, Safari or Firefox. Drag and drop on touch tablets depends on the browser; every move can also be done from the activity editor's date field.

## What would be needed to publish

See *Publishing with GitHub Pages* in the README. In short: merge to `main`, then enable Pages under *Settings → Pages → Deploy from a branch → main / (root)*. The app will be at `https://cristianxperez-dev.github.io/manager-sandbox/`. Nothing has been published.

## If this grows into a full Manager Hub

Adding these would not require a rebuild, because the workspace format, rendering and print renderers are separated:

- **Season mode.** Several months in one workspace, plus a season-level priorities page.
- **Game schedule import** (a CSV of dates, opponents and home/away) as fixed calendar anchors. In the Hub this already existed as `Games`.
- **Templates.** Save a daily layout or a weekly pattern and reuse it.
- **Plan versus actual.** Mark daily rows done, moved or cancelled, so the overview shows planned versus delivered time over a season.
- **Staff view.** Filter or print by staff member or location: "what is every coach doing at 3:00?" The Hub's leadership view is a starting point.
- **Optional roster and groups** from the Hub, opt-in so the planning stays uncluttered.
- **Sharing.** A small backend (or the organization's existing systems) for sync across devices, coordinator review and comments. This is the point where login becomes necessary.
- **Re-integrating Hub modules** (lineups, pitching grid, game-day documents) as separate tabs that read the same workspace.
