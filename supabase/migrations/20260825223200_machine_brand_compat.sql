-- Temporary compatibility alias for advisor task UI; canonical field remains manufacturer.
alter table public.machines add column if not exists brand text generated always as (manufacturer) stored;
