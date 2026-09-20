import { authBaseURL } from './authClient';
import type { CircuitState } from './types';

export interface SavedCircuit {
	id: number;
	name: string;
	data: CircuitState;
	createdAt: string;
	modifiedAt: string;
}

interface CircuitResponse {
	circuit: SavedCircuit;
}

interface CircuitListResponse {
	circuits: SavedCircuit[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${authBaseURL}${path}`, {
		...init,
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...init?.headers
		}
	});

	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as { error?: string } | null;
		throw new Error(body?.error ?? `Circuit request failed with status ${response.status}`);
	}

	return (await response.json()) as T;
}

export async function listSavedCircuits(): Promise<SavedCircuit[]> {
	const response = await request<CircuitListResponse>('/api/circuits');
	return response.circuits;
}

export async function createSavedCircuit(name: string, data: CircuitState): Promise<SavedCircuit> {
	const response = await request<CircuitResponse>('/api/circuits', {
		method: 'POST',
		body: JSON.stringify({ name, data })
	});
	return response.circuit;
}

export async function updateSavedCircuit(
	id: number,
	name: string,
	data: CircuitState
): Promise<SavedCircuit> {
	const response = await request<CircuitResponse>(`/api/circuits/${id}`, {
		method: 'PUT',
		body: JSON.stringify({ name, data })
	});
	return response.circuit;
}

export async function getSavedCircuit(id: number): Promise<SavedCircuit> {
	const response = await request<CircuitResponse>(`/api/circuits/${id}`);
	return response.circuit;
}
