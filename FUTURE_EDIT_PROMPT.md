# Pickleball Pulse - Future Edit and Bug-Fix Prompt

Use this prompt in a new Copilot chat when you want to continue work:

---
I am continuing work on my pickleball event app.

Project path:
- c:\Users\E1418879\InternalAIAgents\pickleball-events-app

Current app behavior and features:
- Public users can view events and submit availability votes.
- Admin access can be unlocked with admin code from config.js.
- Admin can create events, delete events, and delete players from event vote lists.
- Create Event fields include:
  - Event Title
  - Date
  - Start Time
  - End Time
  - Number of Courts
  - Minimum Players Needed
- Events and Voting section is at the top.
- Summary Table is below Events and Voting.
- Past events are highlighted with a different color.
- Time display is 12-hour format.

Important implementation details:
- Frontend is static HTML/CSS/JS using Supabase JS client.
- Config file: config.js
- Main logic: app.js
- Schema/migration script: supabase.sql
- DB model now uses number_of_courts.
- Backward compatibility kept for legacy venue NOT NULL environments.

When fixing bugs:
1. Reproduce the issue in the browser first.
2. Check app.js event listeners and submit handlers.
3. Check Supabase RLS policies in supabase.sql.
4. Check schema mismatches between form payload and DB columns.
5. After edits, bump cache version in index.html script tags if browser seems stale.

Please:
- Make direct code edits in this project.
- Keep changes minimal and backward compatible.
- Validate that create event, vote, delete player, and delete event still work.
- Explain exactly what changed and what SQL I need to rerun in Supabase.
---

## Quick run notes

Local URL (latest expected):
- http://127.0.0.1:5500/?v=13&admin=1

If browser shows old behavior:
- Hard refresh with Ctrl+F5
- or increase script query version in index.html

## Files to check first
- index.html
- app.js
- styles.css
- config.js
- supabase.sql
