-- ============================================================
-- Dream Team — Nombre de camiseta y estatura del jugador.
--
-- El nombre completo se sigue pidiendo porque es con el que la
-- organización identifica a la persona, pero no es el que debe salir en
-- la carta: en la camiseta va el apodo o el apellido, que es más corto y
-- es como lo llaman en la cancha. Son dos datos distintos y hasta ahora
-- se estaban forzando a ser el mismo.
--
-- La estatura entra como dato de la carta, al estilo de las de FIFA.
-- ============================================================

alter table players
  -- Nulo = todavía no lo eligió (los 82 jugadores que ya existen). Quien
  -- lo muestre cae al nombre completo, así nada se rompe.
  add column if not exists jersey_name text,
  -- En centímetros y entero: nadie se mide en milímetros para esto, y
  -- guardarlo como número evita el "1,75" / "1.75" / "175" de un texto
  -- libre.
  add column if not exists height_cm smallint;

-- Los checks van aparte porque `add constraint` no admite IF NOT EXISTS
-- y esta migración tiene que poder correrse dos veces sin romperse.
do $$
begin
  -- 20 caracteres es lo que cabe en la carta sin encogerse a ilegible;
  -- el formulario corta igual, pero el límite de verdad vive acá.
  alter table players
    add constraint players_jersey_name_len
    check (jersey_name is null or char_length(btrim(jersey_name)) between 1 and 20);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  -- Rango amplio a propósito: no es para validar a nadie, es para que un
  -- dedazo (17 cm, 1750 cm) no quede guardado como si fuera cierto.
  alter table players
    add constraint players_height_cm_rango
    check (height_cm is null or height_cm between 120 and 230);
exception
  when duplicate_object then null;
end
$$;
