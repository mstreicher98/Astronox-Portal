<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { FileText, Paperclip, Send, X } from '@lucide/svelte';
	import Modal from './Modal.svelte';
	import type { MailTemplate } from '$lib/server/db/schema';
	import { autosize } from '$lib/ui/actions';
	import { api } from '$lib/ui/form';
	import { toast } from '$lib/ui/toast.svelte';

	/**
	 * E-Mail schreiben. Vorlagen füllen Betreff und Text; {{anrede}}, {{name}},
	 * {{projekt}}, {{nummer}}, {{betrag}}, {{datum}}, {{titel}} werden ersetzt.
	 */
	let {
		open = $bindable(false),
		to = '',
		subject = '',
		text = '',
		template = '',
		values = {},
		customerId = null,
		projectId = null,
		documentId = null,
		documentLabel = '',
		inReplyTo = null,
		references = null,
		onsent
	}: {
		open: boolean;
		to?: string;
		subject?: string;
		text?: string;
		template?: string;
		values?: Record<string, string>;
		customerId?: number | null;
		projectId?: number | null;
		documentId?: number | null;
		documentLabel?: string;
		inReplyTo?: string | null;
		references?: string | null;
		onsent?: () => void;
	} = $props();

	let templates = $state<MailTemplate[]>([]);
	let form = $state({ to: '', cc: '', subject: '', text: '', attachDocument: true });
	let files = $state<File[]>([]);
	let busy = $state(false);
	let picker = $state<HTMLInputElement>();

	const fill = (s: string) => s.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (all, k: string) => values[k] ?? all);

	$effect(() => {
		if (!open) return;
		form = { to, cc: '', subject, text, attachDocument: !!documentId };
		files = [];
		void api<MailTemplate[]>('/api/vorlagen').then((t) => {
			templates = t;
			if (template) choose(template);
		});
	});

	function choose(key: string) {
		const t = templates.find((x) => x.key === key || String(x.id) === key);
		if (!t) return;
		form.subject = fill(t.subject);
		form.text = fill(t.body);
	}

	async function send(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		const fd = new FormData();
		fd.set('to', form.to);
		fd.set('cc', form.cc);
		fd.set('subject', form.subject);
		fd.set('text', form.text);
		if (customerId) fd.set('customerId', String(customerId));
		if (projectId) fd.set('projectId', String(projectId));
		if (documentId) fd.set('documentId', String(documentId));
		if (documentId && form.attachDocument) fd.set('attachDocument', 'on');
		if (inReplyTo) fd.set('inReplyTo', inReplyTo);
		if (references) fd.set('references', references);
		for (const f of files) fd.append('attachments', f);
		try {
			const res = await fetch('/api/mail', { method: 'POST', body: fd });
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body.message || 'Senden fehlgeschlagen');
			toast('E-Mail gesendet');
			open = false;
			onsent?.();
			await invalidateAll();
		} catch (err) {
			toast((err as Error).message, 'error');
		} finally {
			busy = false;
		}
	}
</script>

<Modal bind:open title="E-Mail schreiben" wide>
	<form class="stack" onsubmit={send}>
		<div class="form-grid">
			<label class="field">
				<span>An</span>
				<input type="email" bind:value={form.to} required />
			</label>
			<label class="field">
				<span>Vorlage</span>
				<select onchange={(e) => choose((e.currentTarget as HTMLSelectElement).value)}>
					<option value="">– ohne –</option>
					{#each templates as t (t.id)}<option value={t.key ?? String(t.id)} selected={t.key === template}>{t.name}</option>{/each}
				</select>
			</label>
		</div>
		<label class="field">
			<span>Betreff</span>
			<input bind:value={form.subject} required />
		</label>
		<label class="field">
			<span>Nachricht</span>
			<textarea bind:value={form.text} required rows="10" use:autosize></textarea>
		</label>
		<div class="attach">
			{#if documentId}
				<label class="check"><input type="checkbox" bind:checked={form.attachDocument} /> <FileText size={15} /> {documentLabel || 'Beleg'} als PDF anhängen</label>
			{/if}
			{#each files as f, i (f.name + i)}
				<span class="chip">{f.name} <button type="button" aria-label="Entfernen" onclick={() => files.splice(i, 1)}><X size={12} /></button></span>
			{/each}
			<button class="btn quiet sm" type="button" onclick={() => picker?.click()}><Paperclip size={14} /> Anhang</button>
			<input
				bind:this={picker}
				type="file"
				multiple
				class="sr-only"
				onchange={(e) => {
					files.push(...((e.currentTarget as HTMLInputElement).files ?? []));
					(e.currentTarget as HTMLInputElement).value = '';
				}}
			/>
		</div>
		<details class="small">
			<summary class="faint">Kopie an (CC)</summary>
			<input class="input" type="email" bind:value={form.cc} placeholder="weitere@adresse.at" />
		</details>
		<div class="form-actions">
			<button class="btn ghost" type="button" onclick={() => (open = false)}>Abbrechen</button>
			<button class="btn" class:busy type="submit"><Send size={15} /> Senden</button>
		</div>
	</form>
</Modal>

<style>
	textarea {
		min-height: 14rem !important;
		font-size: 0.92rem;
	}

	.attach {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.attach .chip button {
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		background: none;
		color: var(--dust-2);
		cursor: pointer;
	}

	details input {
		margin-top: 0.4rem;
	}

	summary {
		cursor: pointer;
	}
</style>
