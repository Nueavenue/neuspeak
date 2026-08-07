// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			/** Internal Prisma Account.id — never exposed to the client. */
			accountId: string;
			/** Public-facing account ID shown in the UI, e.g. "NS-A1B2C3D4". */
			accountDisplayId: string;
		}
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
