DO $$
DECLARE
	constraint_name text;
BEGIN
	FOR constraint_name IN
		SELECT con.conname
		FROM pg_constraint con
		JOIN pg_class rel ON rel.oid = con.conrelid
		JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
		JOIN unnest(con.conkey) AS key(attnum) ON true
		JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = key.attnum
		WHERE con.contype = 'f'
			AND nsp.nspname = 'public'
			AND rel.relname = 'post_interactions'
			AND att.attname = 'post_id'
	LOOP
		EXECUTE format('ALTER TABLE public.post_interactions DROP CONSTRAINT IF EXISTS %I', constraint_name);
	END LOOP;

	FOR constraint_name IN
		SELECT con.conname
		FROM pg_constraint con
		JOIN pg_class rel ON rel.oid = con.conrelid
		JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
		JOIN unnest(con.conkey) AS key(attnum) ON true
		JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = key.attnum
		WHERE con.contype = 'f'
			AND nsp.nspname = 'public'
			AND rel.relname = 'post_comments'
			AND att.attname = 'post_id'
	LOOP
		EXECUTE format('ALTER TABLE public.post_comments DROP CONSTRAINT IF EXISTS %I', constraint_name);
	END LOOP;
END $$;
