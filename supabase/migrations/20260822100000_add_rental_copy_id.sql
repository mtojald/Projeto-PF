ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS copy_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS rentals_active_copy_id_unique
  ON public.rentals (lower(btrim(copy_id)))
  WHERE status IN ('active', 'overdue') AND copy_id IS NOT NULL AND btrim(copy_id) <> '';
