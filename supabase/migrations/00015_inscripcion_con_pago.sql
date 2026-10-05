-- ============================================================
-- Dream Team — Inscripción con comprobante de pago.
--
-- El segundo torneo se cobra, así que la inscripción ahora pide el
-- soporte del pago. El admin lo revisa antes de aprobar.
-- ============================================================

alter table registrations
  -- La RUTA dentro del bucket, no una URL. El bucket es privado: la URL
  -- se firma en el momento de mirarla y vence en un minuto.
  add column if not exists payment_proof_path text,
  -- Cuándo el admin dio el pago por bueno. Nulo = sin verificar. Se
  -- separa de `status` a propósito: aprobar la inscripción y verificar
  -- el pago son dos decisiones distintas, y a veces el pago llega por
  -- fuera (efectivo, transferencia que mandaron por WhatsApp).
  add column if not exists payment_verified_at timestamptz;

-- Bucket PRIVADO, a diferencia de player-photos y team-crests.
--
-- Las fotos de jugador son públicas a propósito: salen en las piezas y
-- en la web. Un comprobante de pago no: ahí va el banco, el monto y a
-- veces el número de cuenta de una persona. En un bucket público queda
-- en una URL que cualquiera que la tenga abre, para siempre.
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

-- Sin políticas, como el resto: al bucket solo se llega por el service
-- role desde el servidor, que es quien firma las URLs para el admin.

-- ---------- El torneo de fin de año ----------
--
-- Se crea en 'registration' pero NO se activa solo: el torneo que ve la
-- web lo fija ACTIVE_TOURNAMENT_SLUG. El cambio es una variable de
-- entorno en Vercel, para poder probarlo antes en local.
insert into tournaments (slug, name, status)
values ('fin-de-ano-2026', 'Torneo de Fin de Año Dream Team', 'registration')
on conflict (slug) do nothing;

-- El primer torneo queda cerrado.
update tournaments set status = 'finished' where slug = 'relampago-2026';
