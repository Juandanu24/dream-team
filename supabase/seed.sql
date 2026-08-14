-- Torneo inicial: 1er Torneo Amistoso Dream Team
insert into tournaments (slug, name, status)
values ('relampago-2026', '1er Torneo Amistoso Dream Team', 'registration')
on conflict (slug) do nothing;
