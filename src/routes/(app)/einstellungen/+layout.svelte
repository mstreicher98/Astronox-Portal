<script lang="ts">
	import { page } from '$app/state';
	import { Bell, Building2, CalendarClock, DatabaseBackup, ListChecks, Mail, MailOpen, MessageSquareText, ShieldCheck } from '@lucide/svelte';

	let { children } = $props();
	const items = [
		{ href: '/einstellungen', label: 'Firma & Rechnungen', icon: Building2 },
		{ href: '/einstellungen/termine', label: 'Termine', icon: CalendarClock },
		{ href: '/einstellungen/anfrage', label: 'Projektanfrage', icon: MessageSquareText },
		{ href: '/einstellungen/email', label: 'E-Mail', icon: Mail },
		{ href: '/einstellungen/vorlagen', label: 'E-Mail-Texte', icon: MailOpen },
		{ href: '/einstellungen/checklisten', label: 'Checklisten', icon: ListChecks },
		{ href: '/einstellungen/benachrichtigungen', label: 'Benachrichtigungen', icon: Bell },
		{ href: '/einstellungen/sicherheit', label: 'Sicherheit', icon: ShieldCheck },
		{ href: '/einstellungen/sicherungen', label: 'Sicherungen', icon: DatabaseBackup }
	];
</script>

<div class="page">
	<h1>Einstellungen</h1>
	<div class="layout">
		<nav aria-label="Einstellungen">
			{#each items as it (it.href)}
				<a href={it.href} class:on={page.url.pathname === it.href}><it.icon size={16} /> {it.label}</a>
			{/each}
		</nav>
		<div class="content">{@render children()}</div>
	</div>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: 14rem minmax(0, 1fr);
		gap: 1.25rem;
		align-items: start;
	}

	nav {
		position: sticky;
		top: calc(var(--topbar) + 1rem);
		display: grid;
		gap: 0.15rem;
	}

	nav a {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.75rem;
		border-radius: 10px;
		color: var(--dust);
		font-size: 0.9rem;
		text-decoration: none;
		transition:
			background-color 0.2s,
			color 0.2s;
	}

	nav a:hover {
		color: var(--star);
		background: rgb(255 255 255 / 0.04);
	}

	nav a.on {
		color: var(--star);
		background: linear-gradient(90deg, rgb(var(--accent-rgb) / 0.14), transparent);
	}

	nav a.on :global(svg) {
		color: var(--accent);
	}

	.content {
		display: grid;
		gap: 1rem;
		min-width: 0;
	}

	.content :global(> *) {
		animation: rise 0.45s var(--ease-out) both;
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
		nav {
			position: static;
			display: flex;
			overflow-x: auto;
			scrollbar-width: none;
			gap: 0.3rem;
		}
		nav a {
			white-space: nowrap;
			border: 1px solid var(--line-soft);
			border-radius: 999px;
		}
	}
</style>
