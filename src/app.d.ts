// See https://svelte.dev/docs/kit/types#app.d.ts
import type { User } from '$lib/server/db/schema';

declare global {
	namespace App {
		interface Error {
			message: string;
		}
		interface Locals {
			user: User | null;
			sessionId: string | null;
		}
	}
}

export {};
