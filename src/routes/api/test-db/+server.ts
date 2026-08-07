import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';

/**
 * THROWAWAY connectivity test — proves the app can write to and read from
 * Supabase before any real tables/data are wired up. Delete this route
 * (along with /test-db and supabase/sql/000_test_events.sql) once that's
 * confirmed. See docs/api-architecture.md for the migration plan.
 *
 * Inserts one row into `test_events`, then reads the 5 most recent rows.
 */
export const GET: RequestHandler = async () => {
	const { error: insertError } = await supabase.from('test_events').insert({ message: 'hello from NeuSpeak' });

	if (insertError) {
		console.error('[test-db] insert failed', insertError.message);
		return json(
			{
				error: 'Could not write to Supabase — check PUBLIC_SUPABASE_URL/ANON_KEY and that the table exists.',
				info: 'supabase_insert_error',
				detail: insertError.message
			},
			{ status: 502 }
		);
	}

	const { data: rows, error: selectError } = await supabase
		.from('test_events')
		.select('*')
		.order('created_at', { ascending: false })
		.limit(5);

	if (selectError) {
		console.error('[test-db] select failed', selectError.message);
		return json(
			{
				error: 'Wrote a row but could not read it back — check the table/policy.',
				info: 'supabase_select_error',
				detail: selectError.message
			},
			{ status: 502 }
		);
	}

	return json({ rows: rows ?? [] });
};
