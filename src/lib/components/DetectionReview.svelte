<script lang="ts">
	import { isSweepId } from '$lib/vision/candidates';
	import { ArrowLeft, Send, ScanSearch, Loader2, AlertTriangle } from 'lucide-svelte';
	import type { OpenCvRecognitionInput } from '$lib/recognition';

	interface Props {
		open?: boolean;
		input: OpenCvRecognitionInput | null;
		/** True while the model request is in flight. */
		sending?: boolean;
		/** Surfaced here rather than behind this overlay, where it is invisible. */
		error?: string | null;
		onSend?: () => void;
		onBack?: () => void;
		/** Build the circuit from this on-device scan alone, without the model. */
		onSkip?: () => void;
	}

	let {
		open = false,
		input,
		sending = false,
		error = null,
		onSend = () => {},
		onBack = () => {},
		onSkip = () => {}
	}: Props = $props();

	// The sweep windows (see vision/candidates.ts) are for the model to judge, not boxes to review, so they are not drawn.
	const regions = $derived((input?.request.regions ?? []).filter((region) => !isSweepId(region.id)));
	const width = $derived(input?.request.image_width ?? 0);
	const height = $derived(input?.request.image_height ?? 0);

	// The space the picture may fill (the padding around it is 12px a side), and its size fitted into that.
	let areaWidth = $state(0);
	let areaHeight = $state(0);
	const fit = $derived(
		width > 0 && height > 0 && areaWidth > 24 && areaHeight > 24
			? Math.min((areaWidth - 24) / width, (areaHeight - 24) / height)
			: 0
	);
	const shownWidth = $derived(Math.max(1, Math.floor(width * fit)));
	const shownHeight = $derived(Math.max(1, Math.floor(height * fit)));

	/** Anything this weak is worth visually flagging as a likely false positive. */
	const LOW_CONFIDENCE = 0.5;

	function percent(value: number | null): string {
		return value === null ? '—' : `${Math.round(value * 100)}%`;
	}

	/** Label text scales with the image so it stays legible at any resolution. */
	const labelSize = $derived(Math.max(10, Math.round(Math.max(width, height) / 70)));
</script>

<svelte:window
	onkeydown={(e) => {
		if (open && e.key === 'Escape' && !sending) onBack();
	}}
/>

{#if open && input}
	<div
		class="fixed inset-0 z-modal flex flex-col bg-chrome-950"
		role="dialog"
		aria-modal="true"
		aria-label="Review detected regions"
	>
		<div class="flex flex-shrink-0 items-center justify-between gap-3 border-b border-chrome-600 px-3 py-2 pt-safe">
			<button class="chrome-icon-btn" aria-label="Back" disabled={sending} onclick={onBack}>
				<ArrowLeft size={20} />
			</button>
			<div class="min-w-0 text-center">
				<p class="truncate text-sm font-medium text-chrome-100">On-device detections</p>
				<p class="truncate text-[11px] text-chrome-400">
					{regions.length} region{regions.length === 1 ? '' : 's'} proposed · {input.request
						.client_preprocess_version}
				</p>
			</div>
			<span class="w-9"></span>
		</div>

		<!--
			The picture is the camera's own size, which can be several thousand pixels across. It is shown fitted to the
			space there is (all of it, no scrolling); the boxes are drawn in its pixels and scale with it.
		-->
		<div
			class="thin-scroll flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto bg-black p-3"
			bind:clientWidth={areaWidth}
			bind:clientHeight={areaHeight}
		>
			<div class="relative flex-shrink-0" style={`width: ${shownWidth}px; height: ${shownHeight}px;`}>
				<img
					src={input.imageDataUrl}
					alt="Sharpened sketch with the regions OpenCV proposed"
					class="block h-full w-full rounded-lg"
				/>
				<!--
					Same aspect ratio as the image and stretched over it, so the
					viewBox maps region pixels onto displayed pixels exactly without
					any manual scaling.
				-->
				<svg
					class="pointer-events-none absolute inset-0 h-full w-full"
					viewBox={`0 0 ${width} ${height}`}
					preserveAspectRatio="none"
					aria-hidden="true"
				>
					{#each regions as region (region.id)}
						{@const low =
							region.local_confidence !== null && region.local_confidence < LOW_CONFIDENCE}
						{@const stroke = low ? '#f59e0b' : '#2f6bff'}
						<rect
							x={region.box.x0}
							y={region.box.y0}
							width={Math.max(0, region.box.x1 - region.box.x0)}
							height={Math.max(0, region.box.y1 - region.box.y0)}
							fill={low ? 'rgba(245,158,11,0.10)' : 'rgba(47,107,255,0.10)'}
							{stroke}
							stroke-width={Math.max(1, Math.round(width / 600))}
							rx="4"
						/>
						<text
							x={region.box.x0}
							y={Math.max(labelSize, region.box.y0 - labelSize * 0.35)}
							font-size={labelSize}
							font-weight="600"
							fill={stroke}
							paint-order="stroke"
							stroke="rgba(0,0,0,0.75)"
							stroke-width={labelSize * 0.28}
						>
							{region.local_label ?? 'unlabelled'} · {percent(region.local_confidence)}
						</text>
					{/each}
				</svg>
			</div>

			{#if regions.length === 0}
				<div class="mx-auto mt-4 flex max-w-md flex-col items-center gap-2 rounded-xl border border-dashed border-chrome-600 px-6 py-8 text-center">
					<ScanSearch size={24} class="text-chrome-500" />
					<p class="text-sm font-medium text-chrome-200">No regions found on device</p>
					<p class="text-xs leading-relaxed text-chrome-400">
						The local pass found nothing to propose. The model may still detect components, but a
						sharper, better-lit photo usually helps more than sending this one.
					</p>
				</div>
			{/if}
		</div>

		{#if error}
			<div
				class="flex flex-shrink-0 items-start gap-2 border-t border-signal-danger/30 bg-signal-danger/10 px-4 py-3"
				role="alert"
			>
				<AlertTriangle size={15} class="mt-0.5 flex-shrink-0 text-signal-danger" />
				<p class="text-xs leading-snug text-chrome-100">{error}</p>
			</div>
		{/if}

		<div class="flex flex-shrink-0 items-center justify-between gap-3 border-t border-chrome-600 px-4 py-3 pb-safe">
			<div class="flex items-center gap-3 text-[11px] text-chrome-400">
				<span class="flex items-center gap-1.5">
					<span class="h-2.5 w-2.5 rounded-sm border border-accent bg-accent/20"></span>
					confident
				</span>
				<span class="flex items-center gap-1.5">
					<span class="h-2.5 w-2.5 rounded-sm border border-signal-warn bg-signal-warn/20"></span>
					below {Math.round(LOW_CONFIDENCE * 100)}%
				</span>
			</div>
			<button
				class="flex min-h-touch items-center gap-2 rounded-xl border border-chrome-600 px-4 text-sm font-medium text-chrome-200 transition-colors hover:bg-chrome-700 disabled:opacity-60"
				disabled={sending}
				onclick={onSkip}
			>
				Use scan only
			</button>
			<button
				class="flex min-h-touch items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
				disabled={sending}
				onclick={onSend}
			>
				{#if sending}
					<Loader2 size={17} class="animate-spin" />
					Sending…
				{:else}
					<Send size={17} />
					Send to model
				{/if}
			</button>
		</div>
	</div>
{/if}
