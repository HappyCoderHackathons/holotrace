<script lang="ts">
	import { ChevronLeft, ChevronRight, ImageUp, CheckCircle2, Layers } from 'lucide-svelte';
	import { leftSidebarOpen, circuit } from '$lib/stores/circuit';

	export let onUploadClick: () => void = () => {};

	$: detection = $circuit.detection;
	$: componentCount = $circuit.components.length;
	$: wireCount = $circuit.wires.length;
</script>

{#if $leftSidebarOpen}
	<aside class="flex w-64 flex-shrink-0 flex-col border-r border-surface-200 bg-white">
		<div class="flex items-center justify-between border-b border-surface-200 px-4 py-3">
			<span class="text-sm font-semibold text-ink-900">Source Sketch</span>
			<button
				class="rounded p-1 text-ink-500 hover:bg-surface-100"
				aria-label="Collapse sidebar"
				on:click={() => leftSidebarOpen.set(false)}
			>
				<ChevronLeft size={16} />
			</button>
		</div>

		<div class="thin-scroll flex-1 overflow-y-auto p-4">
			<button
				class="group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-surface-300 bg-surface-50 hover:border-accent"
				on:click={onUploadClick}
			>
				{#if detection.sourceImage}
					<img
						src={detection.sourceImage}
						alt="Uploaded hand-drawn circuit sketch"
						class="h-full w-full object-cover"
					/>
					<div class="absolute inset-0 flex items-center justify-center bg-ink-900/0 opacity-0 transition-opacity group-hover:bg-ink-900/40 group-hover:opacity-100">
						<span class="rounded-md bg-white/95 px-2.5 py-1 text-xs font-medium text-ink-900">
							Replace sketch
						</span>
					</div>
				{:else}
					<div class="flex flex-col items-center gap-2 text-ink-300">
						<ImageUp size={28} />
						<span class="text-xs font-medium">Upload a sketch</span>
					</div>
				{/if}
			</button>

			<div class="mt-4 flex items-start gap-2 rounded-lg bg-live-light px-3 py-2.5">
				<CheckCircle2 size={16} class="mt-0.5 flex-shrink-0 text-live" />
				<p class="text-xs leading-snug text-ink-700">{detection.status}</p>
			</div>

			<div class="mt-4 space-y-2">
				<div class="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink-300">
					<Layers size={12} />
					Circuit Summary
				</div>
				<div class="rounded-lg border border-surface-200 p-3">
					<dl class="space-y-2 text-xs">
						<div class="flex justify-between">
							<dt class="text-ink-500">Components</dt>
							<dd class="font-medium text-ink-900">{componentCount}</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-ink-500">Connections</dt>
							<dd class="font-medium text-ink-900">{wireCount}</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-ink-500">Detected</dt>
							<dd class="font-medium text-ink-900">
								{detection.detectedAt ? new Date(detection.detectedAt).toLocaleTimeString() : '—'}
							</dd>
						</div>
					</dl>
				</div>
			</div>

			<button
				class="mt-4 w-full rounded-lg border border-surface-200 py-2 text-xs font-medium text-ink-700 hover:bg-surface-100"
				on:click={onUploadClick}
			>
				Upload a different sketch
			</button>
		</div>
	</aside>
{:else}
	<button
		class="flex w-8 flex-shrink-0 items-center justify-center border-r border-surface-200 bg-white hover:bg-surface-100"
		aria-label="Expand sidebar"
		on:click={() => leftSidebarOpen.set(true)}
	>
		<ChevronRight size={16} class="text-ink-500" />
	</button>
{/if}
