<script lang="ts">
    import { onMount } from "svelte";
    import { invoke } from '@tauri-apps/api/core';

	// main.ts is self-starting: importing it hooks cv.onRuntimeInitialized and calls its own
	// start(), which looks up #camera and #reset via getElementById - both already in the DOM
	// by the time this fires, so the import can happen on click rather than on mount. The module
	// is cached after the first import, so a second click is a harmless no-op; `started` just
	// keeps the button from looking clickable again.
	let started = $state(false);

	function startCamera() {
		if (started) return;
		started = true;
		import("../../opencv/main");
	}

    async function sendData() {
        console.log("invoke:", invoke);

        const recognitionData =
            document.getElementById("recognition-json");

        const jsonData =
            recognitionData?.innerText ?? "";

        const sharpenedImgCanvas =
            document.getElementById("step-sharpened") as HTMLCanvasElement;

        const imgB64 =
            sharpenedImgCanvas?.toDataURL("image/png") ?? "";

        try {
            const res = await invoke("analyze", {
                json_data: jsonData,
                img_b64: imgB64
            });

            console.log("Recognition response:", res);
        } catch (err) {
            console.error("Analysis failed:", err);
        }
    }

    onMount(() => {
		const interval = setInterval(() => {
			const resetBtn = document.getElementById('reset') as HTMLButtonElement;
            if (!resetBtn) {
                console.warn("Cannot locate reset button!");
                return;
            }
            const sendDataBtn = document.getElementById('send-data') as HTMLButtonElement;
            if (!sendDataBtn) {
                console.warn("Cannot find send-data button!");
                return;
            }
            sendDataBtn.disabled = resetBtn.disabled;
        }, 500);
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden bg-surface-50">
	<div class="flex flex-wrap items-center justify-between gap-2 border-b border-surface-200 bg-white px-4 py-2.5 sm:px-6">
		<h2 class="text-sm font-semibold text-ink-300">Scanner View</h2>
		<div class="flex flex-wrap items-center gap-1.5">
			<button
				class="rounded-md border border-surface-200 px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-surface-100 disabled:opacity-40"
				onclick={startCamera}
				disabled={started}
			>
				{started ? "Camera starting…" : "Start camera"}
			</button>
			<!-- disabled/enabled by main.ts's start(); the "r" key does the same thing -->
			<button
				id="reset"
				class="rounded-md border border-surface-200 px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-surface-100 disabled:opacity-40"
				disabled
			>
				Reset camera
			</button>
			<button
				id="send-data"
				class="rounded-md border border-surface-200 px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-surface-100 disabled:opacity-40"
				onclick={sendData}
                disabled
			>
				Send Data
			</button>
		</div>
	</div>

	<div class="min-h-0 flex-1 overflow-hidden p-3 sm:p-5">
		<div
			class="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-lg border-2 border-schematic bg-white"
		>
			<video id="camera" autoplay playsinline muted hidden></video>

			<!-- fixed at the top of the frame; its own JSON pane scrolls instead of growing the frame -->
			<details id="recognition-panel" hidden open class="shrink-0 border-b border-surface-200">
				<summary class="cursor-pointer select-none px-4 py-2 text-sm font-medium text-ink-700 hover:bg-surface-100">
					Recognition JSON
				</summary>
				<pre id="recognition-json" class="max-h-48 overflow-auto bg-ink-900 px-4 py-3 text-xs text-surface-50"></pre>
			</details>

			<!-- the only part that scrolls when there are more previews than fit; stays inside the frame -->
			<div class="min-h-0 flex-1 overflow-y-auto p-3">
				<div id="steps" class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3"></div>
			</div>
		</div>
	</div>
</div>

<style>
	/* pipeline/preview.ts appends <figure><figcaption><canvas> into #steps at runtime, so these
	   rules have to be :global - Svelte's scoping never sees elements it didn't render. */
	:global(#steps figure) {
		margin: 0;
		overflow: hidden;
		border-radius: 0.5rem;
		border: 1px solid theme("colors.surface.200", #e5e7eb);
		background: #000;
	}
	:global(#steps figcaption) {
		padding: 0.25rem 0.5rem;
		font-size: 0.7rem;
		font-weight: 500;
		color: #fff;
		background: rgba(0, 0, 0, 0.65);
	}
	:global(#steps canvas) {
		display: block;
		width: 100%;
		height: auto;
	}
</style>