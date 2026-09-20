# PostgreSQL

## Role

PostgreSQL is the system of record around recognition, rendering, and simulation. It runs in a standard Docker container and stores what a circuit is, how it changed, how logical components map to their representations, and selected results from saved simulations.

It should not render circuits, execute the simulation loop, store privileged credentials in the client, or serve as the primary home for large binary assets.

```text
Tauri and Svelte client
          |
Holotrace API
          |
PostgreSQL container
    |              |
Object storage   Workers and services
```

Clients should access data through an authenticated API. Database credentials must not be embedded in the web application or a distributed Tauri binary.

The current authentication API uses Better Auth with Drizzle and keeps its `user`, `account`, `session`, and
`verification` records in a separate PostgreSQL `auth` schema. The Python model API remains a separate service and
must not receive user passwords or database credentials. The simplified application `users` table currently remains
unchanged; it is not the credential source for Better Auth. Saved circuit JSON is currently stored in
`public.projects`, whose text `owner` column references `auth.user.id`. The auth service exposes owner-scoped CRUD at
`/api/circuits`; the client does not connect to PostgreSQL directly. This simplified record is an interim persistence
surface and does not replace the versioned circuit model proposed below. The record tracks `lastOpenedAt`; list
requests order by that value, and the authenticated detail request advances it when the circuit is opened.

## Proposed data areas

### Component catalog

- logical component types and properties;
- pins and electrical roles;
- schematic symbols;
- physical packages and dimensions;
- pin-anchor coordinates;
- physical 2D and 3D asset metadata;
- simulation models and simulator mappings;
- component and asset versions;
- licensing and provenance.

### Projects and circuits

- users, workspaces, projects, and authorization;
- circuit identity and version history;
- component instances and their properties;
- nets and net-member pins;
- validation status and unresolved issues;
- 2D and 3D layout revisions;
- source-image and import metadata.

### Recognition

- ML jobs and status;
- preprocessing and model versions;
- raw result payloads;
- detections, confidence, and alternatives;
- mapping from detections to normalized circuit records;
- user corrections and their provenance.

### Simulation

- sessions and their circuit version;
- engine, adapter, and component-model versions;
- simulation parameters and selected signals;
- warnings, failures, and result summaries;
- optionally sampled time-series values.

## Relational data and JSONB

Electrical topology should use relational records and foreign keys. Components, pins, nets, and net membership need referential integrity and should be straightforward to query.

JSONB is useful for raw model output, alternative predictions, bounding regions, flexible engine metadata, layout preferences, and import or export payloads. It should not be the only authoritative representation of a validated circuit.

## Versioning

Treat circuit versions as immutable snapshots or revisions with explicit ancestry. A user correction creates a new version instead of overwriting the evidence produced by recognition.

A simulation session should identify the exact circuit version, simulator and adapter versions, component-model versions, and input parameters used. This makes results reproducible and prevents later catalog changes from silently altering old work.

## Time-series data

Normal PostgreSQL tables are appropriate for users, catalog records, circuits, versions, jobs, and deliberately retained simulation samples such as:

- node voltage;
- branch or component current;
- digital pin state;
- motor speed;
- sampled sensor output.

An illustrative sample identity consists of session, signal, timestamp, numeric value, and unit. Do not write every internal solver step. Select or downsample signals and batch inserts. Add PostgreSQL partitioning or an external archival policy only after measured volume justifies the operational cost.

## Object storage

Store large or frequently delivered binary artifacts outside PostgreSQL:

- source and processed images;
- GLB models and textures;
- large SVG packages;
- firmware binaries;
- full-resolution waveform exports.

PostgreSQL should store the object key or URL, content hash, MIME type, byte size, version, owner, access policy, license, and provenance.

## Offline clients

The Tauri application may cache the current circuit, catalog subset, and assets locally. Synchronization should use stable identifiers, explicit circuit versions, and conflict-aware edits. Offline simulation is possible only for engines and models shipped or cached on the device; PostgreSQL is not part of that live loop.
