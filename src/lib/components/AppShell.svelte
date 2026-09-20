<script lang="ts">
	import { Plus, Pencil, Eye } from 'lucide-svelte';
	import TopNav from './TopNav.svelte';
	import MobileTopBar from './MobileTopBar.svelte';
	import Toolbar from './Toolbar.svelte';
	import SidePanel from './SidePanel.svelte';
	import SketchPanel from './SketchPanel.svelte';
	import PartsPalette from './PartsPalette.svelte';
	import Canvas from './Canvas.svelte';
	import SchematicView from './SchematicView.svelte';
	import ComponentsTable from './ComponentsTable.svelte';
	import BottomTabBar from './BottomTabBar.svelte';
	import SelectionActionBar from './SelectionActionBar.svelte';
	import Sheet from './Sheet.svelte';
	import ToolOptions from './ToolOptions.svelte';
	import Properties from './Properties.svelte';
	import { viewMode, editMode } from '$lib/stores/circuit';
	import { activeSheet, closeSheet, openSheet, isCompact, sketchPanelOpen, partsPanelOpen } from '$lib/stores/ui';

    import LoginPage from '$lib/components/LoginPage.svelte'
    import RegisterPage from '$lib/components/RegisterPage.svelte'
    import SavedCircuitsPage from '$lib/components/SavedCircuitsPage.svelte'

    let page_location = $state<string>("/");

	interface Props {
		onUploadClick?: () => void;
	}

	let { onUploadClick = () => {} }: Props = $props();

	function uploadFromSheet() {
		closeSheet();
		onUploadClick();
	}
</script>

{#if page_location === "/login"}
    <LoginPage bind:location={page_location} />
{:else if page_location === "/register"}
    <RegisterPage bind:location={page_location} />
{:else if page_location === "/circuits"}
    <SavedCircuitsPage bind:location={page_location} />
{:else}
	<div class="flex h-screen flex-col bg-chrome-900">
		<TopNav />

		{#if $viewMode === 'circuit'}
			<Toolbar />
			<div class="flex min-h-0 flex-1 overflow-hidden">
				<SidePanel
					title="Source sketch"
					side="left"
					open={$sketchPanelOpen}
					onToggle={(v) => sketchPanelOpen.set(v)}
				>
					<SketchPanel {onUploadClick} />
				</SidePanel>

				<main class="relative min-h-0 flex-1 overflow-hidden">
					<Canvas editable={$editMode} />
				</main>

				<SidePanel
					title="Components"
					side="right"
					width="w-72"
					open={$partsPanelOpen}
					onToggle={(v) => partsPanelOpen.set(v)}
				>
					<Properties divider="bottom" />
					<PartsPalette />
				</SidePanel>
			</div>
		{:else if $viewMode === 'schematic'}
			<SchematicView />
		{:else}
			<ComponentsTable />
		{/if}
	</div>
{/if}
