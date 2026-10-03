create index if not exists communication_receipts_viewer_idx
  on public.communication_receipts(viewer_id,entity_type,entity_id);
