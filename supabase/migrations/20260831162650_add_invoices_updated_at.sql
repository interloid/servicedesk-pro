-- Add updated_at to invoices so the paypal-webhook handler can timestamp storage updates.
-- IF NOT EXISTS: the initial schema dump was later regenerated with this column
-- already in it, so on a fresh database the column exists by the time this runs.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
