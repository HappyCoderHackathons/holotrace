<script lang="ts">
	import { X } from 'lucide-svelte';
	import { fileNotice } from '$lib/diagramFiles';

	// Fades on its own: what an import or export did is worth a few seconds, not a click.
	$effect(() => {
		if (!$fileNotice) return;
		const timer = setTimeout(() => fileNotice.set(null), $fileNotice.kind === 'error' ? 9000 : 4000);
		return () => clearTimeout(timer);
	});
</script>

{#if $fileNotice}
	<div
		class="pointer-events-none fixed inset-x-0 bottom-6 z-modal flex justify-center px-4"
		role="status"
		aria-live="polite"
	>
		<div
			class="pointer-events-auto flex max-w-lg items-start gap-3 rounded-lg border px-4 py-2.5 text-sm shadow-raised"
			class:border-chrome-600={$fileNotice.kind === 'info'}
			class:bg-chrome-800={$fileNotice.kind === 'info'}
			class:text-chrome-100={$fileNotice.kind === 'info'}
			class:border-red-400={$fileNotice.kind === 'error'}
			class:bg-red-950={$fileNotice.kind === 'error'}
			class:text-red-100={$fileNotice.kind === 'error'}
		>
			<span class="min-w-0 break-words">{$fileNotice.text}</span>
			<button class="flex-shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss" onclick={() => fileNotice.set(null)}>
				<X size={14} />
			</button>
		</div>
	</div>
{/if}
