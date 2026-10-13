import { act } from '$lib/server/forms';
import { dailyBackup, listBackups } from '$lib/server/backup';
import { getSetting } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ backups: await listBackups(), last: (await getSetting('taeglich')).day });

export const actions: Actions = {
	jetzt: act(async () => {
		await dailyBackup();
		return { message: 'Sicherung erstellt' };
	})
};
