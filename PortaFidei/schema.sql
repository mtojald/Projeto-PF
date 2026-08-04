-- ==========================================================================
-- PORTA FIDEI - SCHEMA REFATORADO (ADMIN-ONLY)
-- Cole e execute este script no SQL Editor do seu Dashboard no Supabase
-- ==========================================================================

-- 1. Tabela de Unidades / Localizações
CREATE TABLE IF NOT EXISTS public.locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- 2. Tabela de Livros
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

-- 3. Tabela de Aluguéis (simplificada, admin-only)
CREATE TABLE IF NOT EXISTS public.rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES public.books(id) ON DELETE CASCADE,
  renter_name TEXT NOT NULL,
  renter_contact TEXT DEFAULT '',
  start_date DATE NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 14,
  return_date DATE NOT NULL,
  actual_return_date DATE,
  location_id TEXT REFERENCES public.locations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'returned', 'overdue'
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

-- Livros Iniciais no Acervo
INSERT INTO public.books (title, author, category, cover, location_id, copies_available, copies_total) VALUES
  ('Confissões de Santo Agostinho', 'Santo Agostinho', 'Espiritualidade', 'assets/confissoes.png', 'loc-1', 4, 5),
  ('Suma Teológica (Volume I)', 'Santo Tomás de Aquino', 'Teologia', 'assets/suma-teologica.png', 'loc-1', 2, 3),
  ('Imitação de Cristo', 'Tomás de Kempis', 'Espiritualidade', 'assets/confissoes.png', 'loc-2', 5, 5),
  ('O Castelo Interior', 'Santa Teresa de Ávila', 'Espiritualidade', 'assets/suma-teologica.png', 'loc-2', 3, 3)
ON CONFLICT DO NOTHING;
