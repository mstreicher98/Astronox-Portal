import { act } from '$lib/server/forms';
import { getSetting, setSetting } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ firma: await getSetting('firma'), rechnung: await getSetting('rechnung') });

export const actions: Actions = {
	firma: act(async (_e, f) => {
		await setSetting('firma', {
			name: f.req('name', 'den Firmennamen', 200),
			owner: f.str('owner', 200) ?? '',
			street: f.str('street', 200) ?? '',
			zip: f.str('zip', 20) ?? '',
			city: f.str('city', 100) ?? '',
			country: f.str('country', 80) ?? 'Österreich',
			email: f.email('email') ?? '',
			phone: f.str('phone', 60) ?? '',
			website: f.str('website', 200) ?? '',
			vatId: f.str('vatId', 40) ?? '',
			taxNumber: f.str('taxNumber', 40) ?? '',
			bank: f.str('bank', 100) ?? '',
			iban: (f.str('iban', 40) ?? '').replace(/\s+/g, ' ').toUpperCase(),
			bic: (f.str('bic', 20) ?? '').toUpperCase(),
			footerNote: f.str('footerNote', 300) ?? ''
		});
		return { message: 'Briefkopf gespeichert' };
	}),
	rechnung: act(async (_e, f) => {
		const cur = await getSetting('rechnung');
		await setSetting('rechnung', {
			taxMode: f.oneOf('taxMode', ['klein', 'ust'] as const, 'klein'),
			taxRate: Math.min(30, Math.max(0, f.int('taxRate') ?? 20)),
			kleinText: f.str('kleinText', 300) ?? cur.kleinText,
			invoicePrefix: f.str('invoicePrefix', 30) ?? '',
			quotePrefix: f.str('quotePrefix', 30) ?? '',
			digits: Math.min(6, Math.max(1, f.int('digits') ?? 4)),
			paymentDays: Math.min(120, Math.max(0, f.int('paymentDays') ?? 14)),
			quoteValidDays: Math.min(365, Math.max(1, f.int('quoteValidDays') ?? 30)),
			hourlyRateCents: f.money('hourlyRate') ?? cur.hourlyRateCents,
			quoteIntro: f.str('quoteIntro', 2000) ?? '',
			quoteOutro: f.str('quoteOutro', 2000) ?? '',
			invoiceIntro: f.str('invoiceIntro', 2000) ?? '',
			invoiceOutro: f.str('invoiceOutro', 2000) ?? ''
		});
		return { message: 'Einstellungen für Belege gespeichert' };
	})
};
