<script lang="ts">
	import { onMount } from 'svelte';
	import AppShell from '$lib/components/AppShell.svelte';
	import UploadModal from '$lib/components/UploadModal.svelte';
	import FileNotice from '$lib/components/FileNotice.svelte';
	import { get } from 'svelte/store';
	import { deleteSelected, editMode } from '$lib/stores/circuit';
	import { activeSheet } from '$lib/stores/ui';

	let uploadOpen = $state(false);

	function handleKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		// Not while typing, choosing from a list, or in a dialog: there Backspace and Delete belong to that control.
		if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [aria-modal="true"]')) return;
		if (!get(editMode)) return;
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

<FileNotice />

<UploadModal
	open={uploadOpen}
	onClose={() => {
		uploadOpen = false;
		activeSheet.set(null);
	}}
/>
