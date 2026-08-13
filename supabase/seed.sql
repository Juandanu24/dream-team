-- Torneo inicial: Torneo Relámpago Dream Team
insert into tournaments (slug, name, status)
values ('relampago-2026', 'Torneo Relámpago Dream Team', 'registration')
on conflict (slug) do nothing;
