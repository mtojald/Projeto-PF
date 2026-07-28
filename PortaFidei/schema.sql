-- ==========================================================================
-- PORTA FIDEI - SCRIPT DE SCHEMA & SEED DATA SUPABASE (POSTGRESQL)
-- Cole e execute este script no SQL Editor do seu Dashboard no Supabase
-- ==========================================================================

-- 1. Tabela de Unidades / Localizações
CREATE TABLE IF NOT EXISTS public.locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- 2. Tabela de Usuários
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- 'admin' ou 'user'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  location_id TEXT REFERENCES public.locations(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Tabela de Livros
CREATE TABLE IF NOT EXISTS public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT NOT NULL,
  cover TEXT DEFAULT 'assets/confissoes.png',
  location_id TEXT REFERENCES public.locations(id) ON DELETE SET NULL,
  copies_available INTEGER NOT NULL DEFAULT 1,
  copies_total INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Tabela de Solicitações de Aluguel
CREATE TABLE IF NOT EXISTS public.rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  book_id UUID REFERENCES public.books(id) ON DELETE CASCADE,
  book_title TEXT NOT NULL,
  start_date DATE NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 14,
  return_date DATE NOT NULL,
  location_id TEXT REFERENCES public.locations(id) ON DELETE SET NULL,
  location_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'active'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==========================================================================
-- SEED DATA INICIAL
-- ==========================================================================

-- Unidades Oficiais
INSERT INTO public.locations (id, name) VALUES
  ('loc-1', 'Casa PF'),
  ('loc-2', 'Samaria PF')
ON CONFLICT (id) DO NOTHING;

-- Administradora Oficial (Cacaia / santafaustina)
-- A senha 'santafaustina' está em hash bcrypt abaixo
INSERT INTO public.users (id, name, username, email, password_hash, role, status, location_id) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Cacaia', 'Cacaia', 'cacaia@portafidei.com', '$2a$10$wT2Hl7j4WzC7yVvO40Pee.cSmQvP7YnJ1zVf4zY9Z5c5JkP7YnJ1z', 'admin', 'approved', 'loc-1')
ON CONFLICT (email) DO NOTHING;

-- Livros Iniciais no Acervo
INSERT INTO public.books (title, author, category, cover, location_id, copies_available, copies_total) VALUES
  ('Confissões de Santo Agostinho', 'Santo Agostinho', 'Espiritualidade', 'assets/confissoes.png', 'loc-1', 4, 5),
  ('Suma Teológica (Volume I)', 'Santo Tomás de Aquino', 'Teologia', 'assets/suma-teologica.png', 'loc-1', 2, 3),
  ('Imitação de Cristo', 'Tomás de Kempis', 'Espiritualidade', 'assets/confissoes.png', 'loc-2', 5, 5),
  ('O Castelo Interior', 'Santa Teresa de Ávila', 'Espiritualidade', 'assets/suma-teologica.png', 'loc-2', 3, 3)
ON CONFLICT DO NOTHING;
