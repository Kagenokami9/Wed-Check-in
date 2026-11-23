-- BLUE CHECK-IN Security Hardening:
-- 1. Enable & Force RLS on all public tables + Revoke all anon/authenticated/public access
-- 2. Append-Only triggers protecting audit_logs & system_snapshots from UPDATE/DELETE
-- 3. Zero-DELETE Atomic RPC functions for optimistic concurrency attendance save & full transactional restore

-- ---------------------------------------------------------------------------
-- 1. Zero-Exposure RLS & Least Privilege (BFF Server-Only Access)
-- ---------------------------------------------------------------------------
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms FORCE ROW LEVEL SECURITY;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students FORCE ROW LEVEL SECURITY;

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.attendance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_entries FORCE ROW LEVEL SECURITY;

ALTER TABLE public.app_security_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_security_config FORCE ROW LEVEL SECURITY;

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_rate_limits FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.system_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_snapshots FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.rooms,
  public.students,
  public.attendance_sessions,
  public.attendance_entries,
  public.app_security_config,
  public.auth_rate_limits,
  public.audit_logs,
  public.system_snapshots
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Immutable Append-Only Triggers (audit_logs & system_snapshots)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only; UPDATE and DELETE are forbidden.', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_append_only_mutation() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_append_only_mutation();

CREATE OR REPLACE TRIGGER trg_system_snapshots_immutable
  BEFORE UPDATE OR DELETE ON public.system_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_append_only_mutation();

-- ---------------------------------------------------------------------------
-- 3. Atomic RPC: Save Room Attendance with Optimistic Concurrency Check
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_room_attendance_atomic(
  p_room_id text,
  p_date date,
  p_checked_by text,
  p_expected_version bigint DEFAULT NULL,
  p_force boolean DEFAULT false,
  p_entries jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_session_id text := p_room_id || '_' || to_char(p_date, 'YYYY-MM-DD');
  v_existing public.attendance_sessions%ROWTYPE;
  v_found boolean := false;
  v_next_version bigint := 1;
  v_now timestamptz := now();
  v_before_entries jsonb := '[]'::jsonb;
  v_after_entries jsonb := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.rooms WHERE id = p_room_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'ROOM_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT *
    INTO v_existing
    FROM public.attendance_sessions
   WHERE id = v_session_id
     FOR UPDATE;

  v_found := FOUND;

  IF v_found AND v_existing.deleted_at IS NULL THEN
    IF NOT p_force AND (p_expected_version IS NULL OR v_existing.version <> p_expected_version) THEN
      RETURN jsonb_build_object(
        'conflict', true,
        'current_version', v_existing.version,
        'current_checked_by', v_existing.checked_by,
        'current_updated_at', v_existing.updated_at
      );
    END IF;

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'student_id', e.student_id,
          'status', e.status,
          'note', e.note
        ) ORDER BY e.student_id
      ),
      '[]'::jsonb
    )
      INTO v_before_entries
      FROM public.attendance_entries e
     WHERE e.session_id = v_session_id
       AND e.deleted_at IS NULL;

    v_next_version := v_existing.version + 1;

    UPDATE public.attendance_sessions
       SET checked_by = p_checked_by,
           version = v_next_version,
           updated_at = v_now,
           deleted_at = NULL
     WHERE id = v_session_id;
  ELSIF v_found AND v_existing.deleted_at IS NOT NULL THEN
    v_next_version := v_existing.version + 1;

    UPDATE public.attendance_sessions
       SET checked_by = p_checked_by,
           version = v_next_version,
           updated_at = v_now,
           deleted_at = NULL
     WHERE id = v_session_id;
  ELSE
    INSERT INTO public.attendance_sessions (id, room_id, date, checked_by, version, created_at, updated_at)
    VALUES (v_session_id, p_room_id, p_date, p_checked_by, 1, v_now, v_now);
    v_next_version := 1;
  END IF;

  -- Soft-delete previous active entries for this session, then upsert current entries cleanly
  UPDATE public.attendance_entries
     SET deleted_at = v_now,
         updated_at = v_now
   WHERE session_id = v_session_id
     AND deleted_at IS NULL;

  IF jsonb_typeof(p_entries) = 'array' AND jsonb_array_length(p_entries) > 0 THEN
    INSERT INTO public.attendance_entries (session_id, student_id, status, note, updated_at, deleted_at)
    SELECT
      v_session_id,
      (item->>'studentId')::text,
      (item->>'status')::text,
      NULLIF(btrim(COALESCE(item->>'note', '')), ''),
      v_now,
      NULL
    FROM jsonb_array_elements(p_entries) AS item
    JOIN public.students s ON s.id = (item->>'studentId')::text
    WHERE s.room_id = p_room_id AND s.deleted_at IS NULL
    ON CONFLICT (session_id, student_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      note = EXCLUDED.note,
      updated_at = EXCLUDED.updated_at,
      deleted_at = NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'student_id', e.student_id,
        'status', e.status,
        'note', e.note
      ) ORDER BY e.student_id
    ),
    '[]'::jsonb
  )
    INTO v_after_entries
    FROM public.attendance_entries e
   WHERE e.session_id = v_session_id
     AND e.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'conflict', false,
    'id', v_session_id,
    'room_id', p_room_id,
    'date', to_char(p_date, 'YYYY-MM-DD'),
    'checked_by', p_checked_by,
    'version', v_next_version,
    'updated_at', v_now,
    'before_entries', v_before_entries,
    'after_entries', v_after_entries
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_room_attendance_atomic(text, date, text, bigint, boolean, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_room_attendance_atomic(text, date, text, bigint, boolean, jsonb)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Atomic RPC: Full System Snapshot Restore (Owner Recovery)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_system_snapshot_atomic(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := now();
  v_rooms_count integer := 0;
  v_students_count integer := 0;
  v_sessions_count integer := 0;
  v_entries_count integer := 0;
BEGIN
  IF p_payload IS NULL
     OR jsonb_typeof(p_payload->'rooms') <> 'array'
     OR jsonb_typeof(p_payload->'students') <> 'array'
     OR jsonb_typeof(p_payload->'attendance_sessions') <> 'array'
     OR jsonb_typeof(p_payload->'attendance_entries') <> 'array' THEN
    RAISE EXCEPTION 'INVALID_SNAPSHOT_PAYLOAD' USING ERRCODE = '22023';
  END IF;

  UPDATE public.attendance_entries
     SET deleted_at = v_now, updated_at = v_now
   WHERE deleted_at IS NULL;

  UPDATE public.attendance_sessions
     SET deleted_at = v_now, updated_at = v_now
   WHERE id NOT IN (
     SELECT (r->>'id')::text FROM jsonb_array_elements(p_payload->'attendance_sessions') AS r
   ) AND deleted_at IS NULL;

  UPDATE public.students
     SET deleted_at = v_now, updated_at = v_now
   WHERE id NOT IN (
     SELECT (r->>'id')::text FROM jsonb_array_elements(p_payload->'students') AS r
   ) AND deleted_at IS NULL;

  UPDATE public.rooms
     SET deleted_at = v_now, updated_at = v_now
   WHERE id NOT IN (
     SELECT (r->>'id')::text FROM jsonb_array_elements(p_payload->'rooms') AS r
   ) AND deleted_at IS NULL;

  INSERT INTO public.rooms (id, name, grade, room_number, program, homeroom_teachers, created_at, updated_at, deleted_at)
  SELECT
    (r->>'id')::text,
    (r->>'name')::text,
    (r->>'grade')::smallint,
    (r->>'room_number')::smallint,
    COALESCE(r->>'program', ''),
    COALESCE(r->>'homeroom_teachers', ''),
    COALESCE((r->>'created_at')::timestamptz, v_now),
    COALESCE((r->>'updated_at')::timestamptz, v_now),
    (r->>'deleted_at')::timestamptz
  FROM jsonb_array_elements(p_payload->'rooms') AS r
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    grade = EXCLUDED.grade,
    room_number = EXCLUDED.room_number,
    program = EXCLUDED.program,
    homeroom_teachers = EXCLUDED.homeroom_teachers,
    updated_at = EXCLUDED.updated_at,
    deleted_at = EXCLUDED.deleted_at;

  GET DIAGNOSTICS v_rooms_count = ROW_COUNT;

  INSERT INTO public.students (id, student_code, room_id, seat_number, prefix, first_name, last_name, nickname, roster_note, created_at, updated_at, deleted_at)
  SELECT
    (s->>'id')::text,
    (s->>'student_code')::text,
    (s->>'room_id')::text,
    (s->>'seat_number')::smallint,
    COALESCE(s->>'prefix', ''),
    (s->>'first_name')::text,
    COALESCE(s->>'last_name', ''),
    s->>'nickname',
    s->>'roster_note',
    COALESCE((s->>'created_at')::timestamptz, v_now),
    COALESCE((s->>'updated_at')::timestamptz, v_now),
    (s->>'deleted_at')::timestamptz
  FROM jsonb_array_elements(p_payload->'students') AS s
  ON CONFLICT (id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    room_id = EXCLUDED.room_id,
    seat_number = EXCLUDED.seat_number,
    prefix = EXCLUDED.prefix,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    nickname = EXCLUDED.nickname,
    roster_note = EXCLUDED.roster_note,
    updated_at = EXCLUDED.updated_at,
    deleted_at = EXCLUDED.deleted_at;

  GET DIAGNOSTICS v_students_count = ROW_COUNT;

  INSERT INTO public.attendance_sessions (id, room_id, date, checked_by, version, created_at, updated_at, deleted_at)
  SELECT
    (a->>'id')::text,
    (a->>'room_id')::text,
    (a->>'date')::date,
    (a->>'checked_by')::text,
    GREATEST(COALESCE((a->>'version')::bigint, 1), 1),
    COALESCE((a->>'created_at')::timestamptz, v_now),
    COALESCE((a->>'updated_at')::timestamptz, v_now),
    (a->>'deleted_at')::timestamptz
  FROM jsonb_array_elements(p_payload->'attendance_sessions') AS a
  ON CONFLICT (id) DO UPDATE SET
    room_id = EXCLUDED.room_id,
    date = EXCLUDED.date,
    checked_by = EXCLUDED.checked_by,
    version = EXCLUDED.version,
    updated_at = EXCLUDED.updated_at,
    deleted_at = EXCLUDED.deleted_at;

  GET DIAGNOSTICS v_sessions_count = ROW_COUNT;

  INSERT INTO public.attendance_entries (session_id, student_id, status, note, updated_at, deleted_at)
  SELECT
    (e->>'session_id')::text,
    (e->>'student_id')::text,
    (e->>'status')::text,
    e->>'note',
    COALESCE((e->>'updated_at')::timestamptz, v_now),
    (e->>'deleted_at')::timestamptz
  FROM jsonb_array_elements(p_payload->'attendance_entries') AS e
  ON CONFLICT (session_id, student_id) DO UPDATE SET
    status = EXCLUDED.status,
    note = EXCLUDED.note,
    updated_at = EXCLUDED.updated_at,
    deleted_at = EXCLUDED.deleted_at;

  GET DIAGNOSTICS v_entries_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'rooms_restored', v_rooms_count,
    'students_restored', v_students_count,
    'sessions_restored', v_sessions_count,
    'entries_restored', v_entries_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.restore_system_snapshot_atomic(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_system_snapshot_atomic(jsonb)
  TO service_role;
