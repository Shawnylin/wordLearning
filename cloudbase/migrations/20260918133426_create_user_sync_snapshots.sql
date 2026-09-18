CREATE TABLE public.user_sync_snapshots (
  user_id TEXT PRIMARY KEY NOT NULL DEFAULT auth.uid(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_version INTEGER NOT NULL DEFAULT 1,
  local_updated_at BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sync_snapshots TO authenticated;

ALTER TABLE public.user_sync_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_sync_snapshots_select_own
  ON public.user_sync_snapshots
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_sync_snapshots_insert_own
  ON public.user_sync_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_sync_snapshots_update_own
  ON public.user_sync_snapshots
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_sync_snapshots_delete_own
  ON public.user_sync_snapshots
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
