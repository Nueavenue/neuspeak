import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 config: the Prisma CLI (migrate/generate/studio) reads the
// connection URL from here, not from schema.prisma. The running app reads
// it separately via $env/dynamic/private in src/lib/server/db.ts.
export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: {
		path: 'prisma/migrations'
	},
	datasource: {
		url: env('DATABASE_URL')
	}
});
