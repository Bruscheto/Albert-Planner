# Albert Planner

A Chrome extension that enhances NYU's Albert course registration. Scrapes your shopping cart, throws it on a weekly calendar, and lets you plan your schedule without losing your mind.

## What it does

- **Reads your shopping cart** — auto-parses courses, times, instructors, rooms, credits from Albert's DOM
- **Professor ratings** — auto-fetches Rate My Professors scores for your instructors and shows them in the calendar and course panel. Matches the right NYU professor by name, course code, and title (handles same-last-name ambiguity), and caches results so it isn't hammering RMP. Manual overrides are respected.
- **Calendar page** — full weekly schedule view with conflict highlighting, clean grid layout
- **Priority buckets** — drag courses into Required / High / Medium / Low / Backup tiers
- **Course metadata panel** — quick-view course details (section, day/time, location, instructor rating) without leaving the page
- **Export/Import** — backup your picks as JSON

## Usage

1. Install from Chrome Web Store: https://chromewebstore.google.com/detail/albert-planner/lndleikbfacmkakhcfflpgnlapoekmoa
2. Open your NYU Albert and try it out!

Works on Chrome and Edge (Chromium-based).

## Project structure

```
albert-planner/
├── wxt.config.js                     # WXT manifest/build config
├── entrypoints/                      # WXT entrypoints for background, content, popup, weekly view
├── assets/                           # Extension icons (16/48/128)
└── src/
    ├── background/                   # Service worker runtime: messaging, context menus, RMP enrichment
    ├── content/                      # Albert page runtime + DOM intake
    ├── metadata/                     # Shared course detail drawer/panel
    ├── planner/                      # Planner session loading, conflicts, priority sorting
    ├── popup/                        # Popup / side panel runtime, styles, bucket list UI
    ├── rmp/                          # Rate My Professors lookup + NYU professor matching
    ├── shared/                       # Constants, time parsing, calendar utilities, Chrome mock
    ├── storage/                      # chrome.storage CRUD for courses, buckets, ratings
    └── weekly-view/                  # Calendar view runtime, styles, grid, blocks, drag-drop, buckets
```

## License

MIT
