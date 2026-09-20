<script lang="ts">
	import { onMount } from 'svelte';
	import TopNav from '$lib/components/TopNav.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import LeftSidebar from '$lib/components/LeftSidebar.svelte';
	import RightSidebar from '$lib/components/RightSidebar.svelte';
	import Canvas from '$lib/components/Canvas.svelte';
	import SchematicView from '$lib/components/SchematicView.svelte';
	import ScanView from '$lib/components/Scanner.svelte';
	import ComponentsTable from '$lib/components/ComponentsTable.svelte';
	import UploadModal from '$lib/components/UploadModal.svelte';
	import { viewMode, editMode, deleteSelected } from '$lib/stores/circuit';

	let uploadOpen = $state(false);

	function handleKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
		if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			deleteSelected();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<svelte:head>
	<title>Holotrace — Hand-drawn circuits, digitized</title>
	<meta
		name="description"
		content="Holotrace turns a photo of a hand-drawn circuit sketch into an interactive digital circuit you can view, simulate, and edit."
	/>
</svelte:head>

<div class="flex h-screen flex-col bg-surface-50">
	<TopNav />

	{#if $viewMode === 'circuit'}
		<Toolbar />
		<div class="flex flex-1 overflow-hidden">
			<LeftSidebar onUploadClick={() => (uploadOpen = true)} />
			<main class="relative flex-1 overflow-hidden">
				<Canvas editable={$editMode} />
			</main>
			<RightSidebar />
		</div>
	{:else if $viewMode === 'schematic'}
		<SchematicView />
	{:else if $viewMode === 'components'}
		<ComponentsTable />
	{:else if $viewMode === 'scan'}
		<ScanView />
	{/if}
</div>

<UploadModal open={uploadOpen} onClose={() => (uploadOpen = false)} />
