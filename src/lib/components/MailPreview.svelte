<script lang="ts">
	/** Vorschau einer Mail, so wie sie beim Empfänger ankommt (ohne Skripte, passt die Höhe an) */
	let { html, subject }: { html: string; subject: string } = $props();
	let height = $state(460);

	function fit(e: Event) {
		const doc = (e.currentTarget as HTMLIFrameElement).contentDocument;
		if (doc) height = Math.min(1400, doc.documentElement.scrollHeight + 2);
	}
</script>

<div class="mail-preview">
	<p class="subject"><span>Betreff</span> {subject || '–'}</p>
	<iframe title="Vorschau der E-Mail" srcdoc={html} sandbox="allow-same-origin" style:height="{height}px" onload={fit}></iframe>
</div>

<style>
	.mail-preview {
		display: grid;
		overflow: hidden;
		border: 1px solid var(--line-soft);
		border-radius: 14px;
		background: #eef0f6;
	}

	.subject {
		margin: 0;
		padding: 0.6rem 0.9rem;
		background: rgb(7 13 36 / 0.85);
		color: var(--star);
		font-size: 0.85rem;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.subject span {
		margin-right: 0.4rem;
		color: var(--dust-2);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	iframe {
		width: 100%;
		border: 0;
		background: #eef0f6;
	}
</style>
