<script lang="ts">
	import { Download, PackageOpen } from 'lucide-svelte';
	import { circuit } from '$lib/stores/circuit';
	import { COMPONENT_DISPLAY_NAME } from '$lib/componentLibrary';

	const rows = $derived.by(() => {
		const counts = new Map<string, { refIds: string[]; type: string; count: number }>();
		for (const c of $circuit.components) {
			const displayType = COMPONENT_DISPLAY_NAME[c.type];
			const groupKey = `${displayType}:${c.value ?? ''}`;
			if (!counts.has(groupKey)) counts.set(groupKey, { refIds: [], type: displayType, count: 0 });
			const entry = counts.get(groupKey)!;
			entry.refIds.push(c.refId);
			entry.count += 1;
		}
		return Array.from(counts.values()).map((entry) => ({
			name: entry.refIds.sort().join(', '),
			quantity: entry.count,
			type: entry.type
		}));
	});

	function downloadCsv() {
		const header = 'Name,Quantity,Component\n';
		const body = rows.map((r) => `"${r.name}",${r.quantity},"${r.type}"`).join('\n');
		const blob = new Blob([header + body], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'holotrace-components.csv';
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="thin-scroll h-full overflow-y-auto bg-chrome-900 px-4 py-6 sm:px-8 sm:py-8">
	<div class="mx-auto w-full max-w-3xl">
		<div class="flex items-center justify-between gap-3 border-b border-chrome-600 pb-4">
			<h1 class="text-base font-semibold text-chrome-100 sm:text-lg">Component list</h1>
			<button
				class="flex min-h-touch items-center gap-2 rounded-lg border border-chrome-600 px-3.5 text-sm font-medium text-chrome-200 transition-colors hover:bg-chrome-700 disabled:cursor-not-allowed disabled:text-chrome-500"
				disabled={rows.length === 0}
				onclick={downloadCsv}
			>
				<Download size={15} />
				CSV
			</button>
		</div>

		{#if rows.length === 0}
			<div class="mt-8 flex flex-col items-center gap-3 rounded-xl border border-dashed border-chrome-600 px-6 py-14 text-center">
				<PackageOpen size={26} class="text-chrome-500" />
				<p class="text-sm font-medium text-chrome-200">No components detected yet</p>
				<p class="max-w-xs text-xs leading-relaxed text-chrome-400">
					Upload a sketch or add parts on the circuit canvas, and they will be counted here.
				</p>
			</div>
		{:else}
			<!-- A three-column table is unreadable at 390px, so it becomes cards. -->
			<ul class="mt-6 space-y-2 sm:hidden">
				{#each rows as row (row.name)}
					<li class="rounded-xl border border-chrome-600 bg-chrome-800 p-4">
						<div class="flex items-start justify-between gap-3">
							<div>
								<p class="font-mono text-sm font-semibold text-accent-onDark">{row.name}</p>
								<p class="mt-0.5 text-xs text-chrome-300">{row.type}</p>
							</div>
							<span class="rounded-full bg-chrome-700 px-2.5 py-1 font-mono text-xs text-chrome-100">
								×{row.quantity}
							</span>
						</div>
					</li>
				{/each}
			</ul>

			<div class="mt-6 hidden overflow-hidden rounded-xl border border-chrome-600 sm:block">
				<table class="w-full text-sm">
					<thead>
						<tr class="bg-chrome-800 text-left text-chrome-300">
							<th class="px-6 py-3 font-semibold">Name</th>
							<th class="px-6 py-3 font-semibold">Quantity</th>
							<th class="px-6 py-3 font-semibold">Component</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row (row.name)}
							<tr class="border-t border-chrome-600">
								<td class="px-6 py-3 font-mono text-accent-onDark">{row.name}</td>
								<td class="px-6 py-3 font-mono text-chrome-200">{row.quantity}</td>
								<td class="px-6 py-3 text-chrome-200">{row.type}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
