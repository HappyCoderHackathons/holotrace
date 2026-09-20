import { get, writable } from 'svelte/store';

import { createSavedCircuit, updateSavedCircuit } from '$lib/circuitApi';
import { circuit } from './circuit';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const activeSavedCircuitId = writable<number | null>(null);
export const activeSavedCircuitName = writable('Untitled circuit');
export const saveStatus = writable<SaveStatus>('idle');
export const saveError = writable<string | null>(null);

circuit.subscribe(() => {
	if (get(saveStatus) === 'saved') saveStatus.set('idle');
});

export async function saveCurrentCircuit(): Promise<void> {
	if (get(saveStatus) === 'saving') return;

	saveStatus.set('saving');
	saveError.set(null);

	try {
		const id = get(activeSavedCircuitId);
		const name = get(activeSavedCircuitName);
		const data = get(circuit);
		const saved = id
			? await updateSavedCircuit(id, name, data)
			: await createSavedCircuit(name, data);

		activeSavedCircuitId.set(saved.id);
		activeSavedCircuitName.set(saved.name);
		saveStatus.set('saved');
	} catch (error) {
		saveError.set(error instanceof Error ? error.message : 'Unable to save the circuit.');
		saveStatus.set('error');
		throw error;
	}
}

export function clearSavedCircuitSelection(): void {
	activeSavedCircuitId.set(null);
	activeSavedCircuitName.set('Untitled circuit');
	saveStatus.set('idle');
	saveError.set(null);
}
