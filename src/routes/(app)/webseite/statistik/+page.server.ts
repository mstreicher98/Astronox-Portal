import { desc, gte, sql } from 'drizzle-orm';
import { addDays, today } from '$lib/shared/format';
import { db } from '$lib/server/db';
import { bookings, inquiries, pageViews } from '$lib/server/db/site';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const days = [30, 90, 365].includes(Number(url.searchParams.get('tage'))) ? Number(url.searchParams.get('tage')) : 30;
	const day = today();
	const from = addDays(day, -(days - 1));
	const prevFrom = addDays(from, -days);
	const [perDay, pages, [prev], [inq], [book]] = await Promise.all([
		db.select({ day: pageViews.day, n: sql<number>`sum(${pageViews.views})` }).from(pageViews).where(gte(pageViews.day, from)).groupBy(pageViews.day),
		db
			.select({ path: pageViews.path, n: sql<number>`sum(${pageViews.views})` })
			.from(pageViews)
			.where(gte(pageViews.day, from))
			.groupBy(pageViews.path)
			.orderBy(desc(sql`sum(${pageViews.views})`))
			.limit(15),
		db
			.select({ n: sql<number>`coalesce(sum(${pageViews.views}), 0)` })
			.from(pageViews)
			.where(sql`${pageViews.day} >= ${prevFrom} and ${pageViews.day} < ${from}`),
		db.select({ n: sql<number>`count(*)` }).from(inquiries).where(gte(inquiries.createdAt, `${from}T00:00:00`)),
		db.select({ n: sql<number>`count(*)` }).from(bookings).where(gte(bookings.createdAt, `${from}T00:00:00`))
	]);
	const map = new Map(perDay.map((r) => [r.day, Number(r.n)]));
	const series = Array.from({ length: days }, (_, i) => {
		const d = addDays(from, i);
		return { day: d, value: map.get(d) ?? 0 };
	});
	return {
		days,
		series,
		total: series.reduce((s, x) => s + x.value, 0),
		previous: Number(prev.n),
		pages: pages.map((p) => ({ path: p.path, n: Number(p.n) })),
		inquiries: Number(inq.n),
		bookings: Number(book.n)
	};
};
