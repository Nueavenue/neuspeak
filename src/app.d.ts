// src/app.d.ts
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SupabaseClient, Session, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		interface Locals {
			/** Internal Prisma Account.id — never exposed to the client. */
			accountId: string;
			/** Public-facing account ID shown in the UI, e.g. "NS-A1B2C3D4". */
			accountDisplayId: string;
			/** Request-scoped Supabase client bound to this request's cookies (see src/hooks.server.ts). */
			supabase: SupabaseClient;
			/** Validates the session JWT with Supabase (not just trusting the cookie) — see src/lib/auth/session.ts. */
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
		}
		interface PageData {
			session: Session | null;
			user: User | null;
		}
		// interface Error {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
