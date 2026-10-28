-- ============================================================
-- Dream Team — La cancha es de cada partido, no del torneo.
--
-- Hasta ahora todo se jugaba en la Cancha F8 y el nombre estaba escrito
-- a mano en las piezas, en el mensaje de WhatsApp y en la landing. Se
-- sumó el Complejo Deportivo Rey Pelé, así que deja de ser un dato fijo
-- del proyecto y pasa a ser uno más del partido, como la hora.
--
-- Nulo = la cancha por defecto. Así los partidos que ya existen siguen
-- diciendo lo que decían sin tener que rellenarlos uno por uno, y el
-- día que cambie la sede principal se cambia en un solo sitio.
-- ============================================================

alter table matches
  add column if not exists venue text;

do $$
begin
  -- Un nombre vacío no es "sin cancha": es un descuido. Nulo sí lo es.
  alter table matches
    add constraint matches_venue_len
    check (venue is null or char_length(btrim(venue)) between 2 and 80);
exception
  when duplicate_object then null;
end
$$;
