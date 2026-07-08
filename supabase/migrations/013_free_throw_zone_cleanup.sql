-- 013_free_throw_zone_cleanup.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Free throws have no court location, but the web console historically wrote
-- them with a fake one (zone 'mid_top', x 50, y 38.67 — the FT-line point) to
-- satisfy NOT-NULL-ish assumptions that never existed. The Pi path has always
-- written zone 'free_throw'. As of 2026-07-08 the web writer is fixed
-- (shotService.createShotEvent normalizes FTs to zone 'free_throw', x/y NULL);
-- this migration normalizes the HISTORICAL rows the same way.
--
-- Safe: nothing reads FT locations — every spatial consumer (plotShots,
-- hexbinEngine, aggregateZones, distanceBands, xppa) filters
-- shot_type = 'free_throw' out before touching x/y/zone. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

update shot_events
   set zone = 'free_throw',
       x    = null,
       y    = null
 where shot_type = 'free_throw'
   and (zone is distinct from 'free_throw' or x is not null or y is not null);

-- Verify (expect 0):
--   select count(*) from shot_events
--    where shot_type = 'free_throw'
--      and (zone <> 'free_throw' or x is not null or y is not null);
