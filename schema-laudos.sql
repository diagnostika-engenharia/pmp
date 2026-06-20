-- ============================================================
-- Módulo de Laudos e Pareceres Técnicos — Diagnóstika PMP
-- Aditivo e não-destrutivo (CREATE ... IF NOT EXISTS).
-- ============================================================

create table if not exists public.laudos (
  id            uuid primary key default gen_random_uuid(),
  codigo        text,                         -- ex: DK-LT-MC-001-2026
  titulo        text not null,
  tipo          text not null default 'laudo',    -- laudo | parecer | relatorio | vistoria | art
  condo_id      text not null,                -- chave do CONDOMINIOS (monte-carlo, ...)
  demanda_id    uuid references public.demandas(id) on delete set null,
  status        text not null default 'rascunho', -- rascunho | em_revisao | emitido | entregue
  responsavel   text,
  norma_ref     text,
  valor         numeric,
  pdf_path      text,                         -- caminho no bucket 'laudos'
  observacoes   text,
  data_emissao  date,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_laudos_condo  on public.laudos(condo_id);
create index if not exists idx_laudos_status on public.laudos(status);

alter table public.laudos enable row level security;

-- Acesso total para usuários autenticados (equipe técnica usa o PMP logado).
drop policy if exists laudos_auth_all on public.laudos;
create policy laudos_auth_all on public.laudos
  for all to authenticated using (true) with check (true);

-- Bucket de arquivos dos laudos (PDF). Público para leitura via URL.
insert into storage.buckets (id, name, public)
values ('laudos', 'laudos', true)
on conflict (id) do nothing;

-- Políticas de storage: autenticados gerenciam, público lê.
drop policy if exists laudos_storage_read on storage.objects;
create policy laudos_storage_read on storage.objects
  for select to public using (bucket_id = 'laudos');

drop policy if exists laudos_storage_write on storage.objects;
create policy laudos_storage_write on storage.objects
  for insert to authenticated with check (bucket_id = 'laudos');

drop policy if exists laudos_storage_update on storage.objects;
create policy laudos_storage_update on storage.objects
  for update to authenticated using (bucket_id = 'laudos');

drop policy if exists laudos_storage_delete on storage.objects;
create policy laudos_storage_delete on storage.objects
  for delete to authenticated using (bucket_id = 'laudos');
