-- ============================================================
-- Suscripciones a notificaciones push (Web Push).
-- Una fila por dispositivo: el endpoint que devuelve el navegador
-- más las llaves para cifrar el mensaje.
-- ============================================================

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
