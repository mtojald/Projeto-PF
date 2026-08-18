-- Reviews públicas de livros; escrita protegida pela API administrativa.
CREATE TABLE IF NOT EXISTS public.book_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_title TEXT NOT NULL,
  author TEXT NOT NULL,
  rating NUMERIC(3,1) NOT NULL CHECK (rating >= 0 AND rating <= 10),
  opinion TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.book_reviews ADD COLUMN IF NOT EXISTS book_title TEXT;
ALTER TABLE public.book_reviews ADD COLUMN IF NOT EXISTS author TEXT;
ALTER TABLE public.book_reviews ADD COLUMN IF NOT EXISTS rating NUMERIC(3,1);
ALTER TABLE public.book_reviews ADD COLUMN IF NOT EXISTS opinion TEXT;
ALTER TABLE public.book_reviews ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.book_reviews ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.book_reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.book_reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

CREATE UNIQUE INDEX IF NOT EXISTS book_reviews_book_title_unique
  ON public.book_reviews (lower(trim(book_title)));
CREATE INDEX IF NOT EXISTS book_reviews_pinned_created_idx
  ON public.book_reviews (is_pinned DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_book_reviews_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS book_reviews_updated_at ON public.book_reviews;
CREATE TRIGGER book_reviews_updated_at
  BEFORE UPDATE ON public.book_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_book_reviews_updated_at();
