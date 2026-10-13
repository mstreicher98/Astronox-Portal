import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { today } from '$lib/shared/format';
import { db } from '$lib/server/db';
import { customers, documents, projects } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const type = url.searchParams.get('typ') === 'angebot' ? 'angebot' : 'rechnung';
	const year = /^\d{4}$/.test(url.searchParams.get('jahr') ?? '') ? url.searchParams.get('jahr')! : today().slice(0, 4);
	const rows = await db
		.select({ d: documents, customer: customers.name, project: projects.title })
		.from(documents)
		.innerJoin(customers, eq(customers.id, documents.customerId))
		.leftJoin(projects, eq(projects.id, documents.projectId))
		.where(and(eq(documents.type, type), gte(documents.issueDate, `${year}-01-01`), lte(documents.issueDate, `${year}-12-31`)))
		.orderBy(desc(documents.issueDate), desc(documents.id));
	const years = await db.selectDistinct({ y: documents.issueDate }).from(documents);
	const yearList = [...new Set([today().slice(0, 4), ...years.map((r) => r.y.slice(0, 4))])].sort().reverse();
	return { type, year, years: yearList, documents: rows.map((r) => ({ ...r.d, customer: r.customer, project: r.project })) };
};
