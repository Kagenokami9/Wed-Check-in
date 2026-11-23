-- BLUE CHECK-IN Initial PostgreSQL Schema
-- Follows Supabase Postgres Best Practices:
-- lowercase identifiers, text/bigint/timestamptz, strict CHECK constraints,
-- foreign-key & partial indexes, and soft-delete support for 3-layer recovery.

CREATE TABLE IF NOT EXISTS public.rooms (
  id text PRIMARY KEY,
  name text NOT NULL,
  grade smallint NOT NULL CHECK (grade >= 1 AND grade <= 12),
  room_number smallint NOT NULL CHECK (room_number >= 1 AND room_number <= 99),
  program text NOT NULL DEFAULT '',
  homeroom_teachers text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_rooms_active_sort
  ON public.rooms (grade, room_number)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.students (
  id text PRIMARY KEY,
  student_code text NOT NULL,
  room_id text NOT NULL REFERENCES public.rooms (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  seat_number smallint NOT NULL CHECK (seat_number >= 1 AND seat_number <= 200),
  prefix text NOT NULL DEFAULT '',
  first_name text NOT NULL,
  last_name text NOT NULL DEFAULT '',
  nickname text,
  roster_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_students_active_room_seat
  ON public.students (room_id, seat_number)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_students_room_id
  ON public.students (room_id);

CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id text PRIMARY KEY,
  room_id text NOT NULL REFERENCES public.rooms (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  date date NOT NULL,
  checked_by text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT uq_attendance_sessions_room_date UNIQUE (room_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_active_date
  ON public.attendance_sessions (date DESC, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_room_id
  ON public.attendance_sessions (room_id);

CREATE TABLE IF NOT EXISTS public.attendance_entries (
  session_id text NOT NULL REFERENCES public.attendance_sessions (id) ON UPDATE CASCADE ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES public.students (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'other')),
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_entries_student_id
  ON public.attendance_entries (student_id);

CREATE INDEX IF NOT EXISTS idx_attendance_entries_active_session
  ON public.attendance_entries (session_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.app_security_config (
  id smallint PRIMARY KEY CHECK (id = 1),
  staff_pin_hash text NOT NULL,
  admin_pin_hash text NOT NULL,
  staff_session_version bigint NOT NULL DEFAULT 1 CHECK (staff_session_version >= 1),
  admin_session_version bigint NOT NULL DEFAULT 1 CHECK (admin_session_version >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  key_hash text PRIMARY KEY,
  scope text NOT NULL CHECK (scope IN ('login', 'owner_recovery')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  total_failures_hour integer NOT NULL DEFAULT 0 CHECK (total_failures_hour >= 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  hour_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_locked_until
  ON public.auth_rate_limits (locked_until)
  WHERE locked_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_name text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('member', 'admin', 'owner', 'anonymous', 'system')),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON public.audit_logs (action, created_at DESC);

CREATE TABLE IF NOT EXISTS public.system_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN ('manual', 'pre_delete', 'pre_restore', 'daily_auto', 'initial')),
  created_by text NOT NULL,
  payload jsonb NOT NULL,
  checksum_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_snapshots_created_at
  ON public.system_snapshots (created_at DESC);
