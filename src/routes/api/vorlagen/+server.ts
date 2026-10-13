import { json } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { mailTemplates } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json(await db.select().from(mailTemplates).orderBy(asc(mailTemplates.name)));
