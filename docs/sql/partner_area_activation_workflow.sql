-- partner_area_map activation workflow fields (P0)
-- Purpose: separate assignment from activation and track review state.

alter table public.partner_area_map
  add column if not exists activation_status text not null default 'assigned',
  add column if not exists mandatory_checked_at timestamptz,
  add column if not exists mandatory_missing_keys jsonb,
  add column if not exists partner_submitted_at timestamptz;

create index if not exists partner_area_map_activation_status_idx
  on public.partner_area_map (activation_status);

comment on column public.partner_area_map.activation_status is
  'Workflow state: assigned | in_progress | ready_for_review | active';

comment on column public.partner_area_map.mandatory_checked_at is
  'Timestamp of latest mandatory gate evaluation.';

comment on column public.partner_area_map.mandatory_missing_keys is
  'Last computed missing mandatory keys payload.';

comment on column public.partner_area_map.partner_submitted_at is
  'Timestamp when partner submitted area for admin review.';
