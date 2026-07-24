# Pickleball Pulse Handoff Notes

## Project location
- c:\Users\E1418879\InternalAIAgents\pickleball-events-app

## Stack
- Static frontend: HTML, CSS, vanilla JS
- Backend: Supabase (Postgres + RLS)

## Key files
- index.html: page layout and script includes
- app.js: all app behavior and Supabase calls
- styles.css: UI styles
- config.js: Supabase keys + admin code
- supabase.sql: schema + migration + RLS policies

## Current status
- Admin unlock flow works via admin code and URL flag.
- Create Event uses button-driven submission.
- Events render in Events and Voting and Summary Table.
- Player delete requires admin and vote delete policy.
- Number of Courts is the user-facing field and DB model target.

## Known compatibility guard
- Some older DBs may still have venue NOT NULL.
- app.js currently sends venue fallback from number_of_courts.
- supabase.sql includes: alter column venue drop not null.

## Recovery checklist if app breaks
1. Open app with cache-busted URL.
2. Verify scripts include latest version params in index.html.
3. Re-run supabase.sql in Supabase SQL Editor.
4. Test these flows:
   - Admin unlock
   - Create event
   - Vote submit
   - Delete player
   - Delete event
5. Check browser feedback message and console/network errors.

## Suggested next hardening
- Replace public RLS policies with authenticated admin-only write policies.
- Add separate admin and public roles using Supabase Auth.
- Remove legacy venue fallback after all environments are fully migrated.
