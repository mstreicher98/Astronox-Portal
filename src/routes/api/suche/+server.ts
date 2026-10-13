import { json } from '@sveltejs/kit';
import { desc, eq, like, or } from 'drizzle-orm';
import { money } from '$lib/shared/format';
import { stageOf } from '$lib/shared/stages';
import { db } from '$lib/server/db';
import { contacts, customers, documents, mailMessages, projects } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

/** Schnellsuche für die Befehlspalette */
export const GET: RequestHandler = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
	if (q.length < 2) return json([]);
	const p = `%${q}%`;

	const [kunden, personen, projekte, belege, mails] = await Promise.all([
		db
			.select({ id: customers.id, name: customers.name, city: customers.city, email: customers.email })
			.from(customers)
			.where(or(like(customers.name, p), like(customers.email, p), like(customers.city, p)))
			.limit(6),
		db
			.select({ id: contacts.customerId, name: contacts.name, customer: customers.name })
			.from(contacts)
			.innerJoin(customers, eq(customers.id, contacts.customerId))
			.where(or(like(contacts.name, p), like(contacts.email, p)))
			.limit(4),
		db
			.select({ id: projects.id, title: projects.title, stage: projects.stage, customer: customers.name })
			.from(projects)
			.innerJoin(customers, eq(customers.id, projects.customerId))
			.where(or(like(projects.title, p), like(customers.name, p)))
			.orderBy(desc(projects.updatedAt))
			.limit(6),
		db
			.select({ id: documents.id, type: documents.type, number: documents.number, title: documents.title, gross: documents.grossCents, customer: customers.name })
			.from(documents)
			.innerJoin(customers, eq(customers.id, documents.customerId))
			.where(or(like(documents.number, p), like(documents.title, p)))
			.orderBy(desc(documents.issueDate))
			.limit(5),
		db
			.select({ id: mailMessages.id, subject: mailMessages.subject, from: mailMessages.fromName, addr: mailMessages.fromAddr })
			.from(mailMessages)
			.where(or(like(mailMessages.subject, p), like(mailMessages.fromAddr, p), like(mailMessages.fromName, p)))
			.orderBy(desc(mailMessages.date))
			.limit(4)
	]);

	const seen = new Set<number>();
	return json([
		...[...kunden, ...personen.map((x) => ({ id: x.id, name: `${x.name} (${x.customer})`, city: null, email: null }))]
			.filter((k) => !seen.has(k.id) && seen.add(k.id))
			.map((k) => ({ kind: 'kunde', title: k.name, sub: [k.city, k.email].filter(Boolean).join(' · '), href: `/kunden/${k.id}` })),
		...projekte.map((x) => ({ kind: 'projekt', title: x.title, sub: `${x.customer} · ${stageOf(x.stage).label}`, href: `/projekte/${x.id}` })),
		...belege.map((x) => ({ kind: 'beleg', title: `${x.type === 'angebot' ? 'Angebot' : 'Rechnung'} ${x.number ?? '(Entwurf)'}`, sub: `${x.customer} · ${x.title} · ${money(x.gross)}`, href: `/rechnungen/${x.id}` })),
		...mails.map((x) => ({ kind: 'mail', title: x.subject, sub: x.from || x.addr, href: `/posteingang/${x.id}` }))
	]);
};
