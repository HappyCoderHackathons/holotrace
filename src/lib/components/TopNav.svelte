<script lang="ts">
	import { Cpu, FolderOpen, Save, Share2 } from 'lucide-svelte';
	import { viewMode } from '$lib/stores/circuit';
	import type { ViewMode } from '$lib/types';
	import { authClient } from '$lib/authClient';
	import { clearSavedCircuitSelection, saveCurrentCircuit, saveError, saveStatus } from '$lib/stores/savedCircuits';

    interface Props {
        location: string;
		onExport?: () => void;
	}

	const tabs: { id: ViewMode; label: string }[] = [
		{ id: 'circuit', label: 'Circuit' },
		{ id: 'schematic', label: 'Schematic' },
		{ id: 'components', label: 'Components' }
	];
    let { location = $bindable(""), onExport = () => {} } : Props = $props();
    const session = authClient.useSession();

    function gotoLogin() {
        location = "/login"
    }

    async function logout() {
        await authClient.signOut();
		authClient.hydrateSession(null);
		clearSavedCircuitSelection();
        location = "/";
    }

	async function save() {
		if (!$session.data) {
			location = '/login';
			return;
		}

		try {
			await saveCurrentCircuit();
		} catch {
			// The save store exposes the error state for the button label.
		}
	}

	function gotoSavedCircuits() {
		location = $session.data ? '/circuits' : '/login';
	}
</script>

<!--
	Three equal grid columns rather than an absolutely positioned centre nav:
	the old approach let the tab group slide under the wordmark once the window
	dropped below roughly 900px.
-->
<header
	class="grid h-14 flex-shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-chrome-600 bg-chrome-900 px-4"
>
	<div class="flex items-center gap-2.5">
		<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
			<Cpu size={18} strokeWidth={2.25} />
		</div>
		<span class="text-[15px] font-semibold tracking-[-0.01em] text-chrome-100">Holotrace</span>
	</div>

	<nav class="flex items-center gap-0.5 rounded-lg bg-chrome-950 p-1" aria-label="View">
		{#each tabs as tab (tab.id)}
			{@const active = $viewMode === tab.id}
			<button
				class="rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors"
				class:bg-chrome-700={active}
				class:text-chrome-100={active}
				class:text-chrome-300={!active}
				class:hover:text-chrome-200={!active}
				aria-current={active ? 'page' : undefined}
				onclick={() => viewMode.set(tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</nav>

	<div class="flex items-center justify-end gap-2">
		<button
			class="flex items-center gap-1.5 rounded-lg border border-chrome-600 px-3.5 py-2 text-sm font-medium text-chrome-200 transition-colors hover:bg-chrome-700"
			onclick={gotoSavedCircuits}
		>
			<FolderOpen size={14} />
			Saved
		</button>
		<button
			class="flex items-center gap-1.5 rounded-lg border border-chrome-600 px-3.5 py-2 text-sm font-medium text-chrome-200 transition-colors hover:bg-chrome-700 disabled:opacity-50"
			disabled={$saveStatus === 'saving'}
			title={$saveError ?? 'Save the current circuit'}
			onclick={save}
		>
			<Save size={14} />
			{$saveStatus === 'saving' ? 'Saving…' : $saveStatus === 'saved' ? 'Saved' : $saveStatus === 'error' ? 'Retry save' : 'Save'}
		</button>
		{#if $session.data}
			<span class="hidden text-sm text-chrome-300 lg:inline">{$session.data.user.name}</span>
			<button
				class="flex items-center gap-1.5 rounded-lg border border-chrome-600 px-3.5 py-2 text-sm font-medium text-chrome-200 transition-colors hover:bg-chrome-700"
				onclick={logout}
			>
				Logout
			</button>
		{:else}
			<button
				class="flex items-center gap-1.5 rounded-lg border border-chrome-600 px-3.5 py-2 text-sm font-medium text-chrome-200 transition-colors hover:bg-chrome-700"
				onclick={gotoLogin}
			>
				Login
			</button>
		{/if}
		<button
			class="flex items-center gap-1.5 rounded-lg border border-chrome-600 px-3.5 py-2 text-sm font-medium text-chrome-200 transition-colors hover:bg-chrome-700"
			onclick={onExport}
		>
			<Share2 size={14} />
			Export
		</button>
	</div>
</header>
