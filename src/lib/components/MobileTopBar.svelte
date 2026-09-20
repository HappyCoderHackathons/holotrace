<script lang="ts">
	import { Cpu, Image, SlidersHorizontal, Play, Square, Undo2, Redo2, LogIn, LogOut } from 'lucide-svelte';
	import { viewMode, undo, redo, canUndo, canRedo } from '$lib/stores/circuit';
	import { openSheet } from '$lib/stores/ui';
	import { simulationRunning, startSimulation, stopSimulation } from '$lib/stores/simulation';
	import { authClient } from '$lib/authClient';

	const onCanvas = $derived($viewMode === 'circuit');
	const session = authClient.useSession();
	let { location = $bindable('') } = $props();

	async function toggleAuthentication() {
		if ($session.data) {
			await authClient.signOut();
			location = '/';
			return;
		}

		location = '/login';
	}
</script>

<header
	class="flex h-13 flex-shrink-0 items-center gap-1 border-b border-chrome-600 bg-chrome-900 px-2 pt-safe"
	style="height: calc(3.25rem + env(safe-area-inset-top));"
>
	<div class="flex items-center gap-2 pl-1">
		<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
			<Cpu size={16} strokeWidth={2.25} />
		</div>
		<span class="text-sm font-semibold tracking-[-0.01em] text-chrome-100">Holotrace</span>
	</div>

	<div class="ml-auto flex items-center gap-0.5">
		<button
			class="chrome-icon-btn"
			aria-label={$session.data ? 'Log out' : 'Log in'}
			onclick={toggleAuthentication}
		>
			{#if $session.data}
				<LogOut size={18} />
			{:else}
				<LogIn size={18} />
			{/if}
		</button>

		{#if onCanvas}
			<button class="chrome-icon-btn" aria-label="Undo" disabled={!$canUndo} onclick={undo}>
				<Undo2 size={18} />
			</button>
			<button class="chrome-icon-btn" aria-label="Redo" disabled={!$canRedo} onclick={redo}>
				<Redo2 size={18} />
			</button>
			<button
				class="chrome-icon-btn"
				aria-label="Source sketch"
				onclick={() => openSheet('sketch')}
			>
				<Image size={18} />
			</button>
			<button
				class="chrome-icon-btn"
				aria-label="Wire and tool options"
				onclick={() => openSheet('tools')}
			>
				<SlidersHorizontal size={18} />
			</button>

			{#if $simulationRunning}
				<button
					class="ml-1 flex min-h-touch items-center gap-1.5 rounded-lg bg-chrome-700 px-3 text-sm font-semibold text-chrome-100"
					onclick={stopSimulation}
				>
					<Square size={12} fill="currentColor" />
					Stop
				</button>
			{:else}
				<button
					class="ml-1 flex min-h-touch items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-white"
					onclick={startSimulation}
				>
					<Play size={12} fill="currentColor" />
					Run
				</button>
			{/if}
		{/if}
	</div>
</header>
