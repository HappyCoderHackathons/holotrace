<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowLeft, CircuitBoard, Clock3, FolderOpen, Loader2, RefreshCw } from 'lucide-svelte';

	import { authClient } from '$lib/authClient';
	import { listSavedCircuits, type SavedCircuitSummary } from '$lib/circuitApi';
	import { openSavedCircuit } from '$lib/stores/savedCircuits';

	let { location = $bindable('') } = $props();

	let circuits = $state<SavedCircuitSummary[]>([]);
	let loading = $state(true);
	let openingId = $state<number | null>(null);
	let signedIn = $state(false);
	let error = $state<string | null>(null);

	const dateFormatter = new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	function formatDate(value: string): string {
		return dateFormatter.format(new Date(value));
	}

	async function refresh() {
		loading = true;
		error = null;

		try {
			const session = await authClient.getSession();
			signedIn = Boolean(session.data);

			if (!session.data) {
				circuits = [];
				return;
			}

			authClient.hydrateSession(session.data);
			circuits = await listSavedCircuits();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Unable to load saved circuits.';
		} finally {
			loading = false;
		}
	}

	async function openCircuit(id: number) {
		openingId = id;
		error = null;

		try {
			await openSavedCircuit(id);
			location = '/';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Unable to open this circuit.';
		} finally {
			openingId = null;
		}
	}

	onMount(() => {
		void refresh();
	});
</script>

<div class="min-h-[100dvh] bg-chrome-900 px-4 py-8 text-chrome-100 sm:px-8">
	<div class="mx-auto max-w-4xl">
		<div class="mb-6 flex items-center justify-between gap-4">
			<button
				class="flex items-center gap-1.5 text-sm font-medium text-chrome-400 transition-colors hover:text-chrome-200"
				onclick={() => (location = '/')}
			>
				<ArrowLeft size={15} />
				Back to editor
			</button>
			<button
				class="chrome-icon-btn"
				aria-label="Refresh saved circuits"
				disabled={loading}
				onclick={refresh}
			>
				<RefreshCw size={17} class={loading ? 'animate-spin' : ''} />
			</button>
		</div>

		<div class="mb-6 flex items-center gap-3">
			<div class="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white">
				<FolderOpen size={22} />
			</div>
			<div>
				<h1 class="text-xl font-semibold">Saved circuits</h1>
				<p class="text-sm text-chrome-400">Most recently opened circuits appear first.</p>
			</div>
		</div>

		{#if error}
			<div class="mb-4 rounded-lg border border-signal-danger/30 bg-signal-danger/10 px-4 py-3 text-sm text-chrome-100" role="alert">
				{error}
			</div>
		{/if}

		{#if loading}
			<div class="flex items-center justify-center gap-2 rounded-xl border border-chrome-700 bg-chrome-800 py-16 text-sm text-chrome-400">
				<Loader2 size={18} class="animate-spin" />
				Loading saved circuits…
			</div>
		{:else if !signedIn}
			<div class="rounded-xl border border-chrome-700 bg-chrome-800 px-6 py-12 text-center">
				<p class="text-sm text-chrome-300">Log in to see circuits saved to your account.</p>
				<button class="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white" onclick={() => (location = '/login')}>
					Log in
				</button>
			</div>
		{:else if circuits.length === 0}
			<div class="rounded-xl border border-dashed border-chrome-600 bg-chrome-800/50 px-6 py-16 text-center">
				<CircuitBoard size={28} class="mx-auto text-chrome-500" />
				<p class="mt-3 text-sm font-medium text-chrome-200">No saved circuits yet</p>
				<p class="mt-1 text-xs text-chrome-400">Create one from a sketch or save the circuit in the editor.</p>
			</div>
		{:else}
			<div class="grid gap-3 sm:grid-cols-2">
				{#each circuits as saved (saved.id)}
					<article class="rounded-xl border border-chrome-700 bg-chrome-800 p-4 shadow-raised">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<h2 class="truncate text-sm font-semibold text-chrome-100">{saved.name}</h2>
								<p class="mt-1 flex items-center gap-1.5 text-xs text-chrome-400">
									<Clock3 size={13} />
									Opened {formatDate(saved.lastOpenedAt)}
								</p>
							</div>
							<button
								class="flex min-h-touch shrink-0 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-medium text-white disabled:opacity-60"
								disabled={openingId !== null}
								onclick={() => openCircuit(saved.id)}
							>
								{#if openingId === saved.id}<Loader2 size={14} class="animate-spin" />{/if}
								Open
							</button>
						</div>
						<p class="mt-4 border-t border-chrome-700 pt-3 text-[11px] text-chrome-500">
							Last saved {formatDate(saved.modifiedAt)}
						</p>
					</article>
				{/each}
			</div>
		{/if}
	</div>
</div>
