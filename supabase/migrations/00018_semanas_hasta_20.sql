-- ============================================================
-- Dream Team — Subir el tope de fechas de 10 a 20.
--
-- Corrige una incoherencia que quedó abierta: el formulario de
-- calendario ya acepta hasta la semana 20 —se subió al rehacerlo para
-- que un torneo de seis equipos quepa, porque un todos contra todos de
-- seis son quince partidos— pero la base siguió con el `check (week
-- between 1 and 10)` de la migración 00001.
--
-- O sea que zod dejaba pasar la semana 11 y Postgres la rechazaba con un
-- 23514 que la interfaz no traduce. Comprobado contra el torneo de
-- pruebas: la 11 falla, la 10 pasa.
--
-- El torneo 2 va para más de seis equipos, así que esto se iba a tocar
-- la primera vez que se programara una fecha pasada la décima.
-- ============================================================

alter table matches drop constraint if exists matches_week_check;

alter table matches
  add constraint matches_week_check check (week between 1 and 20);
