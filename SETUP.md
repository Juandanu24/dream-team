# SETUP — Dream Team

Pasos que solo tú puedes hacer para dejar el sitio funcionando. Son ~10 minutos.

## 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) → **New project**.
2. Nombre: `dream-team` (o el que quieras). Región: la más cercana (`us-east-1` va bien
   para Colombia). Guarda la contraseña de la base de datos donde no se te pierda.
3. Espera a que el proyecto termine de aprovisionarse.

## 2. Correr la migración y el seed

1. En el dashboard: **SQL Editor** → **New query**.
2. Pega el contenido completo de `supabase/migrations/00001_esquema_inicial.sql` → **Run**.
   Debe terminar sin errores (crea tablas, vistas, bucket de fotos y RLS).
3. Nueva query: pega `supabase/seed.sql` → **Run**. Eso crea el torneo
   `relampago-2026`, que es el slug que usa la app (`ACTIVE_TOURNAMENT_SLUG`).

## 3. Llenar `.env.local`

1. Copia el ejemplo:
   ```bash
   cp .env.example .env.local
   ```
2. En el dashboard: **Project Settings → API Keys**.
   - `NEXT_PUBLIC_SUPABASE_URL` → la **Project URL**.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → la key **publishable** (`sb_publishable_…`;
     en proyectos viejos se llama `anon`).
   - `SUPABASE_SERVICE_ROLE_KEY` → la key **secret** (`sb_secret_…` o `service_role`).
     Esta es la peligrosa: nunca sale del servidor ni se commitea.

## 4. Crear tu usuario admin

1. Dashboard: **Authentication → Users → Add user → Create new user**.
2. Email y contraseña tuyos. Marca **Auto Confirm User**.
3. Repite para los demás organizadores (pocos: cualquier usuario autenticado es admin).
4. Opcional pero recomendado: **Authentication → Sign In / Providers → Email** y
   desactiva **Allow new users to sign up**, para que nadie más pueda crearse cuenta.

## 5. Probar en local

```bash
pnpm dev
```

- `http://localhost:3000` — landing.
- `/inscripcion` — inscríbete tú de prueba con una foto.
- `/admin` — entra con tu usuario y aprueba tu propia inscripción.
- `/torneo` — por ahora casi todo en estados vacíos (equipos y fixture vienen en la
  siguiente fase).

## 6. Deploy en Vercel (cuando quieras publicarlo)

1. Sube el repo a GitHub (privado está bien).
2. En [vercel.com](https://vercel.com): **Add New → Project** → importa el repo.
   Framework: Next.js, sin configuración extra.
3. En **Environment Variables** agrega las mismas tres variables de `.env.local`.
4. Deploy. El dominio `*.vercel.app` queda de una; si luego quieres dominio propio,
   se agrega en Settings → Domains.
