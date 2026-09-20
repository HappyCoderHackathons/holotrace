<script lang="ts">
	import { onMount } from 'svelte';
	import AppShell from '$lib/components/AppShell.svelte';
	import UploadModal from '$lib/components/UploadModal.svelte';
	import { deleteSelected } from '$lib/stores/circuit';
	import { activeSheet } from '$lib/stores/ui';

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

<AppShell onUploadClick={() => (uploadOpen = true)} />

<UploadModal
	open={uploadOpen}
	onClose={() => {
		uploadOpen = false;
		activeSheet.set(null);
	}}
/>
