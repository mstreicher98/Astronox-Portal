import { env } from '$env/dynamic/private';
import { eq, isNotNull } from 'drizzle-orm';
import { CONTENT_KEYS, type ContentKey } from '$lib/shared/site';
import { db } from './db';
import { siteContent } from './db/site';
import { previewToken } from './secret';

/**
 * Inhalte der Webseite bearbeiten. Gespeichert wird zuerst als Entwurf, den
 * nur die Vorschau zeigt; „Veröffentlichen“ macht ihn auf astronox.dev sichtbar
 * (die Webseite liest die Tabelle alle paar Sekunden neu).
 */

export const websiteUrl = () => (env.WEBSITE_URL || 'https://astronox.dev').replace(/\/+$/, '');
export const previewUrl = (path = '/') => `${websiteUrl()}${path.startsWith('/') ? path.split('#')[0] : '/'}?vorschau=${previewToken()}${path.includes('#') ? `#${path.split('#')[1]}` : ''}`;

export const isKey = (k: string): k is ContentKey => (CONTENT_KEYS as string[]).includes(k);

export async function loadSection(key: ContentKey) {
	const [row] = await db.select().from(siteContent).where(eq(siteContent.key, key));
	if (!row) return null;
	return {
		value: JSON.parse(row.draft ?? row.published),
		hasDraft: !!row.draft,
		publishedAt: row.publishedAt,
		updatedAt: row.updatedAt
	};
}

export async function sectionStates() {
	const rows = await db.select({ key: siteContent.key, draft: siteContent.draft, publishedAt: siteContent.publishedAt, updatedAt: siteContent.updatedAt }).from(siteContent);
	return Object.fromEntries(rows.map((r) => [r.key, { hasDraft: !!r.draft, publishedAt: r.publishedAt, updatedAt: r.updatedAt }]));
}

const safeUrl = (v: unknown) => (typeof v === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(v.trim()) ? v.trim() : '');
const safeMedia = (v: unknown) => (typeof v === 'string' && /^\/medien\/[\w-]+\.(webp|avif|jpg|png)$/.test(v) ? v : '');

/** Werte säubern: Texte kürzen, Links und Bildpfade prüfen */
function clean(value: unknown, field = '', max = 4000): unknown {
	if (typeof value === 'string') {
		if (field === 'url') return safeUrl(value);
		if (field === 'image' || field === 'photo') return safeMedia(value);
		return value.replace(/\r\n/g, '\n').slice(0, field === 'markdown' ? 60_000 : max);
	}
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
	if (Array.isArray(value)) return value.slice(0, 40).map((v) => clean(v, field, max));
	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v, k, max)]));
	}
	return null;
}

export async function saveDraft(key: ContentKey, value: unknown) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ungültige Daten');
	const json = JSON.stringify(clean(value));
	const [row] = await db.select({ published: siteContent.published }).from(siteContent).where(eq(siteContent.key, key));
	// Entwurf gleich veröffentlicht? Dann gibt es keinen Entwurf
	const draft = row && row.published === json ? null : json;
	await db.update(siteContent).set({ draft, updatedAt: new Date().toISOString() }).where(eq(siteContent.key, key));
	return draft !== null;
}

export async function publish(key?: ContentKey) {
	const rows = key ? await db.select().from(siteContent).where(eq(siteContent.key, key)) : await db.select().from(siteContent).where(isNotNull(siteContent.draft));
	const now = new Date().toISOString();
	let n = 0;
	for (const r of rows) {
		if (!r.draft) continue;
		await db.update(siteContent).set({ published: r.draft, draft: null, publishedAt: now, updatedAt: now }).where(eq(siteContent.key, r.key));
		n++;
	}
	return n;
}

export async function discard(key?: ContentKey) {
	if (key) await db.update(siteContent).set({ draft: null }).where(eq(siteContent.key, key));
	else await db.update(siteContent).set({ draft: null }).where(isNotNull(siteContent.draft));
}
