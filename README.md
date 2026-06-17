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
├── manifest.json                     # MV3 manifest
├── vite.config.js                    # Optional build (copies src → dist); also runs unbuilt
├── assets/                           # Extension icons (16/48/128)
└── src/
    ├── background.js                 # Service worker: messaging, context menus, RMP rating enrichment
    ├── content.js                    # DOM observer, course scraping (times, rooms, instructors)
    ├── content.css                   # Injected page styles
    ├── course-storage.js             # chrome.storage CRUD for courses, buckets, ratings
    ├── course-metadata-panel.js/css  # Course detail panel (section, day/time, location, rating)
    ├── bucket-manager.js             # Bucket UI + drag-drop logic
    ├── planner.js                    # Conflict detection & schedule optimization
    ├── rmp-service.js                # Rate My Professors lookup + NYU professor matching
    ├── chrome-mock.js                # Mocks Chrome APIs for local dev
    ├── popup.html/css/js             # Extension popup / side panel
    ├── weekly-view.html/css/js       # Full calendar view (entry point)
    ├── weekly-view/                  # Calendar modules: grid, blocks, drag-drop, buckets, drawer, colors…
    └── utils/
        ├── constants.js              # Selectors, config, defaults
        ├── time-parser.js            # "09:30 AM - 10:45 AM", "TTh" → structured data
        └── calendar-utils.js         # Grid layout, overlap detection
```

## License

MIT
