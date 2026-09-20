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
    {#if $isCompact}
        <!-- Compact: the canvas owns the screen, everything else is a sheet or a bar. -->
        <div class="flex h-[100dvh] flex-col bg-chrome-900">
            <MobileTopBar bind:location={page_location} />

            <main class="relative min-h-0 flex-1 overflow-hidden">
                {#if $viewMode === 'circuit'}
                    <Canvas editable={$editMode} />
                    <SelectionActionBar />

                    <div class="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between">
                        <button
                            class="pointer-events-auto flex min-h-touch items-center gap-1.5 rounded-full border border-chrome-600 bg-chrome-900/95 px-3.5 text-sm font-medium text-chrome-200 shadow-raised backdrop-blur"
                            aria-pressed={$editMode}
                            onclick={() => editMode.set(!$editMode)}
                        >
                            {#if $editMode}
                                <Pencil size={15} /> Edit
                            {:else}
                                <Eye size={15} /> View
                            {/if}
                        </button>

                        <button
                            class="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-accent"
                            aria-label="Add a component"
                            onclick={() => openSheet('parts')}
                        >
                            <Plus size={24} strokeWidth={2.25} />
                        </button>
                    </div>
                {:else if $viewMode === 'schematic'}
                    <SchematicView />
                {:else}
                    <ComponentsTable />
                {/if}
            </main>

            <BottomTabBar />
        </div>

        <Sheet open={$activeSheet === 'parts'} title="Add component" onClose={closeSheet}>
            <PartsPalette compact onPlaced={closeSheet} />
        </Sheet>

        <Sheet open={$activeSheet === 'sketch'} title="Source sketch" maxHeight="78vh" onClose={closeSheet}>
            <SketchPanel onUploadClick={uploadFromSheet} />
        </Sheet>

        <Sheet open={$activeSheet === 'tools'} title="Tools and wires" maxHeight="52vh" onClose={closeSheet}>
            <div class="pb-2">
                <ToolOptions size="touch" />
            </div>
        </Sheet>
    {:else}
        <div class="flex h-screen flex-col bg-chrome-900">
            <TopNav bind:location={page_location} />

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
{/if}
