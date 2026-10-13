import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { contacts, customers } from './db/schema';

/** Kunde zu einer E-Mail-Adresse finden – bei der Firma selbst oder bei einer Ansprechperson */
export async function customerByEmail(email: string | null | undefined): Promise<number | null> {
	const e = email?.trim().toLowerCase();
	if (!e) return null;
	const [c] = await db
		.select({ id: customers.id })
		.from(customers)
		.where(sql`lower(${customers.email}) = ${e}`)
		.orderBy(customers.archivedAt, customers.id)
		.limit(1);
	if (c) return c.id;
	const [p] = await db
		.select({ id: contacts.customerId })
		.from(contacts)
		.where(sql`lower(${contacts.email}) = ${e}`)
		.limit(1);
	return p?.id ?? null;
}

/** Kunde zu einer Anfrage oder Buchung: vorhandenen nehmen oder neu anlegen */
export async function ensureCustomer(p: { name: string; company?: string | null; email: string; phone?: string | null; source: string }): Promise<{ id: number; created: boolean }> {
	const existing = await customerByEmail(p.email);
	if (existing) return { id: existing, created: false };
	const company = p.company?.trim();
	const [c] = await db
		.insert(customers)
		.values({
			kind: company ? 'firma' : 'privat',
			name: company || p.name,
			email: p.email.toLowerCase(),
			phone: p.phone ?? null,
			source: p.source
		})
		.returning({ id: customers.id });
	if (company) {
		await db.insert(contacts).values({ customerId: c.id, name: p.name, email: p.email.toLowerCase(), phone: p.phone ?? null, isPrimary: true });
	}
	return { id: c.id, created: true };
}

/** Alle E-Mail-Adressen eines Kunden (für Mails und Zuordnung) */
export async function customerEmails(customerId: number): Promise<string[]> {
	const [c] = await db.select({ email: customers.email }).from(customers).where(eq(customers.id, customerId));
	const people = await db.select({ email: contacts.email }).from(contacts).where(eq(contacts.customerId, customerId));
	return [...new Set([c?.email, ...people.map((x) => x.email)].filter((x): x is string => !!x).map((x) => x.toLowerCase()))];
}

/** Empfänger für Post an den Kunden: Hauptkontakt vor Firmenadresse */
export async function primaryRecipient(customerId: number): Promise<{ name: string; email: string; salutationName: string } | null> {
	const [c] = await db.select().from(customers).where(eq(customers.id, customerId));
	if (!c) return null;
	const people = await db
		.select()
		.from(contacts)
		.where(eq(contacts.customerId, customerId))
		.orderBy(sql`${contacts.isPrimary} desc`, contacts.id);
	const person = people.find((p) => p.email);
	if (person?.email) return { name: person.name, email: person.email, salutationName: person.name };
	return c.email ? { name: c.name, email: c.email, salutationName: c.kind === 'privat' ? c.name : '' } : null;
}
