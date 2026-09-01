-- Encuadre de la foto de cada jugador.
--
-- Las fotos las manda cada quien desde su celular: unas son de cuerpo
-- entero, otras un primer plano, otras horizontales. Un recorte fijo
-- que sirve para una le corta la cabeza a la siguiente. Estos tres
-- números dicen cómo encuadrar ESA foto y viajan con el jugador, así el
-- ajuste se hace una vez y no cada vez que se arma una pieza.
--
-- Convención (la misma que ya usaba la pieza del duelo): el zoom parte
-- de 1 = la foto justo cubre el marco, y los desplazamientos van de -1 a
-- 1 midiéndose contra lo que sobra, de modo que ±1 pega la foto contra
-- el borde y nunca deja un vacío.
--
-- Nulo = sin ajustar: cada pieza aplica su encuadre por defecto.
alter table players
  add column photo_zoom real check (photo_zoom between 1 and 3),
  add column photo_offset_x real check (photo_offset_x between -1 and 1),
  add column photo_offset_y real check (photo_offset_y between -1 and 1);
