# Draft PostgreSQL schema

This document proposes a relational schema for Holotrace. It is an architecture reference, not a migration and not evidence that these tables exist. Before implementation, validate it against the selected authentication system, API access patterns, PostgreSQL version, retention requirements, and the first supported component set.

The design has four main boundaries:

1. The component catalog describes logical parts, packages, render assets, pins, and simulation models.
2. Immutable circuit versions describe component instances, instance pins, and electrical nets.
3. Recognition records preserve ML provenance and uncertain predictions.
4. Simulation sessions reference an exact circuit version and optionally persist selected time-series signals.

Large images, firmware, GLB files, textures, and waveform exports belong in object storage. PostgreSQL stores their identity, integrity metadata, and relationships.

## Database features

Holotrace uses standard PostgreSQL in a Docker container. The schema must not depend on provider-specific extensions.

```sql
CREATE SCHEMA IF NOT EXISTS holotrace;
```

UUIDs use PostgreSQL's `gen_random_uuid()`. Status-like values use `CHECK` constraints in this draft so adding a state does not require changing a PostgreSQL enum.

## Accounts, workspaces, and projects

Authentication is currently provided by a self-hosted Better Auth service. Better Auth owns its tables in a separate
PostgreSQL `auth` schema and its user ID is the stable authenticated subject. In the planned full application schema,
`auth_subject` links application-owned records to that identifier without copying credentials into application
tables. The client must access these records through the Holotrace API rather than connecting directly to PostgreSQL.

The current simplified implementation predates this full schema. It stores saved circuit JSON in `public.projects`
and links `public.projects.owner` directly to `auth.user.id`; authenticated CRUD is exposed at `/api/circuits`. This
is an interim bridge for user-owned saves, not an implementation of the workspace and immutable-version tables below.

```sql
CREATE TABLE holotrace.app_user (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_subject    text NOT NULL UNIQUE,
    display_name    text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE holotrace.workspace (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    created_by      uuid NOT NULL REFERENCES holotrace.app_user(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE holotrace.workspace_member (
    workspace_id    uuid NOT NULL REFERENCES holotrace.workspace(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES holotrace.app_user(id) ON DELETE CASCADE,
    role            text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE holotrace.project (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid NOT NULL REFERENCES holotrace.workspace(id) ON DELETE CASCADE,
    name            text NOT NULL,
    description     text,
    created_by      uuid NOT NULL REFERENCES holotrace.app_user(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_workspace_idx
    ON holotrace.project (workspace_id, updated_at DESC);
```

## Stored artifacts

An artifact may be workspace-owned or globally available. `object_key` is an opaque storage identifier rather than an unrestricted public URL. The API can exchange it for an authorized or signed delivery URL.

```sql
CREATE TABLE holotrace.artifact (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid REFERENCES holotrace.workspace(id) ON DELETE CASCADE,
    kind            text NOT NULL CHECK (kind IN (
                        'source_image',
                        'processed_image',
                        'schematic_svg',
                        'physical_2d',
                        'model_3d',
                        'texture',
                        'firmware',
                        'waveform',
                        'other'
                    )),
    object_key      text NOT NULL UNIQUE,
    mime_type       text NOT NULL,
    byte_size       bigint NOT NULL CHECK (byte_size >= 0),
    sha256          text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    license_id      text,
    source_uri      text,
    provenance      jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by      uuid REFERENCES holotrace.app_user(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX artifact_workspace_kind_idx
    ON holotrace.artifact (workspace_id, kind, created_at DESC);
```

## Component catalog

A component definition represents electrical meaning. A package represents a physical implementation. Pins are logical terminals; package pins map those terminals onto a particular package.

`workspace_id IS NULL` denotes a shared catalog record. Workspace-owned definitions allow private or custom components without changing the global catalog.

```sql
CREATE TABLE holotrace.component_definition (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        uuid REFERENCES holotrace.workspace(id) ON DELETE CASCADE,
    slug                text NOT NULL,
    name                text NOT NULL,
    category            text NOT NULL,
    manufacturer        text,
    manufacturer_part   text,
    description         text,
    properties          jsonb NOT NULL DEFAULT '{}'::jsonb,
    catalog_version     integer NOT NULL DEFAULT 1 CHECK (catalog_version > 0),
    is_active           boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX component_definition_global_slug_uq
    ON holotrace.component_definition (slug)
    WHERE workspace_id IS NULL;

CREATE UNIQUE INDEX component_definition_workspace_slug_uq
    ON holotrace.component_definition (workspace_id, slug)
    WHERE workspace_id IS NOT NULL;

CREATE INDEX component_definition_properties_gin
    ON holotrace.component_definition USING gin (properties jsonb_path_ops);

CREATE TABLE holotrace.component_pin (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id        uuid NOT NULL REFERENCES holotrace.component_definition(id) ON DELETE CASCADE,
    pin_key             text NOT NULL,
    name                text NOT NULL,
    electrical_role     text,
    ordinal             integer NOT NULL CHECK (ordinal >= 0),
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (component_id, pin_key),
    UNIQUE (component_id, ordinal)
);

CREATE TABLE holotrace.component_package (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id        uuid NOT NULL REFERENCES holotrace.component_definition(id) ON DELETE CASCADE,
    package_key         text NOT NULL,
    name                text NOT NULL,
    dimensions_mm       jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (component_id, package_key),
    UNIQUE (id, component_id)
);

CREATE TABLE holotrace.package_pin (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id          uuid NOT NULL REFERENCES holotrace.component_package(id) ON DELETE CASCADE,
    component_pin_id    uuid NOT NULL REFERENCES holotrace.component_pin(id) ON DELETE CASCADE,
    physical_label      text NOT NULL,
    anchor_2d           jsonb,
    anchor_3d           jsonb,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (package_id, component_pin_id),
    UNIQUE (package_id, physical_label)
);

CREATE TABLE holotrace.component_representation (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id        uuid NOT NULL REFERENCES holotrace.component_definition(id) ON DELETE CASCADE,
    package_id          uuid REFERENCES holotrace.component_package(id) ON DELETE CASCADE,
    representation_kind text NOT NULL CHECK (representation_kind IN (
                            'schematic_svg',
                            'physical_2d',
                            'model_3d'
                        )),
    artifact_id         uuid NOT NULL REFERENCES holotrace.artifact(id),
    detail_level        integer NOT NULL DEFAULT 0 CHECK (detail_level >= 0),
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (package_id, component_id)
        REFERENCES holotrace.component_package(id, component_id) ON DELETE CASCADE,
    UNIQUE NULLS NOT DISTINCT (
        component_id,
        package_id,
        representation_kind,
        detail_level
    )
);
```

The application must validate that each `package_pin.component_pin_id` belongs to the same component definition as its package. This can become a composite foreign key once concrete catalog write patterns have been tested.

## Simulation catalog

Simulation engines and models are versioned independently from visual assets. Model definitions may be compact text or JSON; large model bundles remain artifacts in object storage.

```sql
CREATE TABLE holotrace.simulation_engine (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    engine_key      text NOT NULL,
    name            text NOT NULL,
    version         text NOT NULL,
    capabilities    jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (engine_key, version)
);

CREATE TABLE holotrace.simulation_model (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    engine_id       uuid NOT NULL REFERENCES holotrace.simulation_engine(id),
    model_key       text NOT NULL,
    version         integer NOT NULL DEFAULT 1 CHECK (version > 0),
    definition      text,
    artifact_id     uuid REFERENCES holotrace.artifact(id),
    parameters      jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CHECK (definition IS NOT NULL OR artifact_id IS NOT NULL),
    UNIQUE (engine_id, model_key, version),
    UNIQUE (id, engine_id)
);

CREATE TABLE holotrace.component_simulation_model (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id    uuid NOT NULL REFERENCES holotrace.component_definition(id) ON DELETE CASCADE,
    package_id      uuid,
    engine_id       uuid NOT NULL REFERENCES holotrace.simulation_engine(id),
    model_id        uuid NOT NULL,
    pin_mapping     jsonb NOT NULL,
    parameter_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
    interaction_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_default      boolean NOT NULL DEFAULT false,
    FOREIGN KEY (model_id, engine_id)
        REFERENCES holotrace.simulation_model(id, engine_id),
    FOREIGN KEY (package_id, component_id)
        REFERENCES holotrace.component_package(id, component_id) ON DELETE CASCADE,
    UNIQUE NULLS NOT DISTINCT (component_id, package_id, model_id)
);

CREATE UNIQUE INDEX component_default_simulation_model_for_package_uq
    ON holotrace.component_simulation_model (component_id, package_id, engine_id)
    WHERE is_default AND package_id IS NOT NULL;

CREATE UNIQUE INDEX component_default_simulation_model_without_package_uq
    ON holotrace.component_simulation_model (component_id, engine_id)
    WHERE is_default AND package_id IS NULL;
```

The two default-model indexes permit one component-wide default and one default per package and engine. Splitting the nullable and non-null package cases avoids PostgreSQL's default treatment of `NULL` values as distinct.

## ML recognition

Recognition jobs preserve the raw model result. Individual detections support review, component matching, and traceability back to a region of the source image.

```sql
CREATE TABLE holotrace.ml_model_version (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    model_key       text NOT NULL,
    version         text NOT NULL,
    artifact_id     uuid REFERENCES holotrace.artifact(id),
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (model_key, version)
);

CREATE TABLE holotrace.recognition_job (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          uuid NOT NULL REFERENCES holotrace.project(id) ON DELETE CASCADE,
    source_artifact_id  uuid NOT NULL REFERENCES holotrace.artifact(id),
    processed_artifact_id uuid REFERENCES holotrace.artifact(id),
    model_version_id    uuid REFERENCES holotrace.ml_model_version(id),
    status              text NOT NULL CHECK (status IN (
                            'queued',
                            'preprocessing',
                            'running',
                            'succeeded',
                            'failed',
                            'cancelled'
                        )),
    preprocessing       jsonb NOT NULL DEFAULT '{}'::jsonb,
    raw_result          jsonb,
    error               jsonb,
    requested_by        uuid NOT NULL REFERENCES holotrace.app_user(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    started_at          timestamptz,
    completed_at        timestamptz
);

CREATE INDEX recognition_job_project_idx
    ON holotrace.recognition_job (project_id, created_at DESC);

CREATE TABLE holotrace.recognition_detection (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recognition_job_id      uuid NOT NULL REFERENCES holotrace.recognition_job(id) ON DELETE CASCADE,
    detection_kind          text NOT NULL CHECK (detection_kind IN (
                                'component',
                                'pin',
                                'wire',
                                'junction',
                                'crossing',
                                'label',
                                'other'
                            )),
    source_region           jsonb NOT NULL,
    recognized_text         text,
    confidence              double precision CHECK (confidence BETWEEN 0.0 AND 1.0),
    candidates              jsonb NOT NULL DEFAULT '[]'::jsonb,
    selected_component_id   uuid REFERENCES holotrace.component_definition(id),
    review_state            text NOT NULL DEFAULT 'unreviewed' CHECK (review_state IN (
                                'unreviewed',
                                'accepted',
                                'corrected',
                                'rejected'
                            )),
    reviewed_by             uuid REFERENCES holotrace.app_user(id),
    reviewed_at             timestamptz,
    metadata                jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX recognition_detection_job_idx
    ON holotrace.recognition_detection (recognition_job_id, detection_kind);
```

## Circuits and immutable versions

A circuit is the long-lived identity. A circuit version is an immutable electrical revision. Layout changes may be versioned independently beneath a circuit version when they do not change connectivity.

```sql
CREATE TABLE holotrace.circuit (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      uuid NOT NULL REFERENCES holotrace.project(id) ON DELETE CASCADE,
    name            text NOT NULL,
    created_by      uuid NOT NULL REFERENCES holotrace.app_user(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX circuit_project_idx
    ON holotrace.circuit (project_id, updated_at DESC);

CREATE TABLE holotrace.circuit_version (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    circuit_id          uuid NOT NULL REFERENCES holotrace.circuit(id) ON DELETE CASCADE,
    version_number      integer NOT NULL CHECK (version_number > 0),
    parent_version_id   uuid,
    recognition_job_id  uuid REFERENCES holotrace.recognition_job(id),
    schema_version      integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
    ir_schema_version   text NOT NULL DEFAULT 'circuit-ir-v0' CHECK (length(ir_schema_version) > 0),
    status              text NOT NULL CHECK (status IN (
                            'recognized',
                            'needs_review',
                            'electrically_valid',
                            'simulatable',
                            'archived'
                        )),
    change_summary      text,
    created_by          uuid NOT NULL REFERENCES holotrace.app_user(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (parent_version_id, circuit_id)
        REFERENCES holotrace.circuit_version(id, circuit_id),
    UNIQUE (circuit_id, version_number),
    UNIQUE (id, circuit_id)
);

-- schema_version tracks the relational storage shape; ir_schema_version
-- records the typed Circuit IR contract, such as circuit-ir-v0.

CREATE TABLE holotrace.component_instance (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    circuit_version_id      uuid NOT NULL REFERENCES holotrace.circuit_version(id) ON DELETE CASCADE,
    component_id            uuid REFERENCES holotrace.component_definition(id),
    package_id              uuid,
    source_detection_id     uuid REFERENCES holotrace.recognition_detection(id),
    reference_designator    text NOT NULL,
    display_name            text,
    properties              jsonb NOT NULL DEFAULT '{}'::jsonb,
    recognition_confidence  double precision CHECK (recognition_confidence BETWEEN 0.0 AND 1.0),
    resolution_state        text NOT NULL DEFAULT 'resolved' CHECK (resolution_state IN (
                                'resolved',
                                'inferred',
                                'ambiguous',
                                'unknown'
                            )),
    FOREIGN KEY (package_id, component_id)
        REFERENCES holotrace.component_package(id, component_id),
    CHECK (package_id IS NULL OR component_id IS NOT NULL),
    UNIQUE (circuit_version_id, reference_designator),
    UNIQUE (id, circuit_version_id)
);

CREATE TABLE holotrace.component_instance_pin (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    circuit_version_id  uuid NOT NULL REFERENCES holotrace.circuit_version(id) ON DELETE CASCADE,
    component_instance_id uuid NOT NULL,
    component_pin_id    uuid REFERENCES holotrace.component_pin(id),
    package_pin_id      uuid REFERENCES holotrace.package_pin(id),
    pin_key             text NOT NULL,
    display_name        text,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    FOREIGN KEY (component_instance_id, circuit_version_id)
        REFERENCES holotrace.component_instance(id, circuit_version_id)
        ON DELETE CASCADE,
    UNIQUE (component_instance_id, pin_key),
    UNIQUE (id, circuit_version_id)
);

CREATE TABLE holotrace.net (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    circuit_version_id  uuid NOT NULL REFERENCES holotrace.circuit_version(id) ON DELETE CASCADE,
    net_key             text NOT NULL,
    name                text,
    kind                text NOT NULL DEFAULT 'signal' CHECK (kind IN (
                            'signal',
                            'power',
                            'ground',
                            'unresolved'
                        )),
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (circuit_version_id, net_key),
    UNIQUE (id, circuit_version_id)
);

CREATE TABLE holotrace.net_member (
    circuit_version_id  uuid NOT NULL REFERENCES holotrace.circuit_version(id) ON DELETE CASCADE,
    net_id              uuid NOT NULL,
    instance_pin_id     uuid NOT NULL,
    FOREIGN KEY (net_id, circuit_version_id)
        REFERENCES holotrace.net(id, circuit_version_id)
        ON DELETE CASCADE,
    FOREIGN KEY (instance_pin_id, circuit_version_id)
        REFERENCES holotrace.component_instance_pin(id, circuit_version_id)
        ON DELETE CASCADE,
    PRIMARY KEY (net_id, instance_pin_id),
    UNIQUE (circuit_version_id, instance_pin_id)
);
```

The duplicated `circuit_version_id` values allow composite foreign keys to prevent a net from referencing a pin in another circuit version. The service should treat committed circuit versions as immutable; database triggers or permission separation can enforce this after the write workflow is settled.

## Validation issues

Validation results point to a circuit-level object without forcing every possible issue target into a nullable foreign-key collection.

```sql
CREATE TABLE holotrace.validation_issue (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    circuit_version_id  uuid NOT NULL REFERENCES holotrace.circuit_version(id) ON DELETE CASCADE,
    severity            text NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
    issue_code          text NOT NULL,
    message             text NOT NULL,
    target_kind         text,
    target_id           uuid,
    details             jsonb NOT NULL DEFAULT '{}'::jsonb,
    resolved_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX validation_issue_open_idx
    ON holotrace.validation_issue (circuit_version_id, severity)
    WHERE resolved_at IS NULL;
```

`target_kind` and `target_id` are intentionally polymorphic. The validation service must verify that the target belongs to the same circuit version.

## Layouts

A circuit version may have multiple generated or user-edited layouts. Electrical connectivity remains in nets; visible wire routes remain layout data.

```sql
CREATE TABLE holotrace.circuit_layout (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    circuit_version_id  uuid NOT NULL REFERENCES holotrace.circuit_version(id) ON DELETE CASCADE,
    layout_kind         text NOT NULL CHECK (layout_kind IN (
                            'schematic_2d',
                            'physical_2d',
                            'physical_3d'
                        )),
    revision            integer NOT NULL CHECK (revision > 0),
    generator           text,
    generator_version   text,
    viewport            jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by          uuid REFERENCES holotrace.app_user(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (circuit_version_id, layout_kind, revision),
    UNIQUE (id, circuit_version_id)
);

CREATE TABLE holotrace.component_placement (
    circuit_version_id  uuid NOT NULL REFERENCES holotrace.circuit_version(id) ON DELETE CASCADE,
    layout_id           uuid NOT NULL,
    component_instance_id uuid NOT NULL,
    position_x          double precision NOT NULL DEFAULT 0,
    position_y          double precision NOT NULL DEFAULT 0,
    position_z          double precision NOT NULL DEFAULT 0,
    rotation_x          double precision NOT NULL DEFAULT 0,
    rotation_y          double precision NOT NULL DEFAULT 0,
    rotation_z          double precision NOT NULL DEFAULT 0,
    rotation_w          double precision NOT NULL DEFAULT 1,
    scale_x             double precision NOT NULL DEFAULT 1,
    scale_y             double precision NOT NULL DEFAULT 1,
    scale_z             double precision NOT NULL DEFAULT 1,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    FOREIGN KEY (layout_id, circuit_version_id)
        REFERENCES holotrace.circuit_layout(id, circuit_version_id)
        ON DELETE CASCADE,
    FOREIGN KEY (component_instance_id, circuit_version_id)
        REFERENCES holotrace.component_instance(id, circuit_version_id)
        ON DELETE CASCADE,
    PRIMARY KEY (layout_id, component_instance_id)
);

CREATE TABLE holotrace.wire_route (
    circuit_version_id  uuid NOT NULL REFERENCES holotrace.circuit_version(id) ON DELETE CASCADE,
    layout_id           uuid NOT NULL,
    net_id              uuid NOT NULL,
    route               jsonb NOT NULL,
    style               jsonb NOT NULL DEFAULT '{}'::jsonb,
    FOREIGN KEY (layout_id, circuit_version_id)
        REFERENCES holotrace.circuit_layout(id, circuit_version_id)
        ON DELETE CASCADE,
    FOREIGN KEY (net_id, circuit_version_id)
        REFERENCES holotrace.net(id, circuit_version_id)
        ON DELETE CASCADE,
    PRIMARY KEY (layout_id, net_id)
);
```

Quaternions are represented by `rotation_x`, `rotation_y`, `rotation_z`, and `rotation_w` so the same placement can drive a 3D renderer without Euler-order ambiguity. Two-dimensional layouts use `position_x`, `position_y`, and rotation around the relevant axis.

## Simulation sessions and signals

The live solver state stays in memory near the simulation engine. PostgreSQL persists session identity, reproducibility information, selected signal definitions, summaries, and intentionally sampled output.

```sql
CREATE TABLE holotrace.simulation_session (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    circuit_version_id  uuid NOT NULL REFERENCES holotrace.circuit_version(id),
    engine_id           uuid NOT NULL REFERENCES holotrace.simulation_engine(id),
    status              text NOT NULL CHECK (status IN (
                            'created',
                            'running',
                            'paused',
                            'completed',
                            'failed',
                            'cancelled'
                        )),
    configuration       jsonb NOT NULL DEFAULT '{}'::jsonb,
    model_manifest      jsonb NOT NULL DEFAULT '{}'::jsonb,
    summary             jsonb,
    error               jsonb,
    created_by          uuid NOT NULL REFERENCES holotrace.app_user(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    started_at          timestamptz,
    completed_at        timestamptz
);

CREATE INDEX simulation_session_circuit_idx
    ON holotrace.simulation_session (circuit_version_id, created_at DESC);

CREATE TABLE holotrace.simulation_signal (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          uuid NOT NULL REFERENCES holotrace.simulation_session(id) ON DELETE CASCADE,
    signal_key          text NOT NULL,
    name                text NOT NULL,
    quantity            text NOT NULL,
    unit                text NOT NULL,
    source_kind         text,
    source_id           uuid,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (session_id, signal_key),
    UNIQUE (id, session_id)
);
```

## Sampled simulation values

Only selected or downsampled output belongs here. Do not insert every internal solver iteration. Batch writes and define retention or tiering only after measuring real product usage.

```sql
CREATE TABLE holotrace.simulation_sample (
    sampled_at         timestamptz NOT NULL,
    session_id         uuid NOT NULL,
    signal_id          uuid NOT NULL,
    value              double precision NOT NULL,
    quality            smallint,
    metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
    FOREIGN KEY (signal_id, session_id)
        REFERENCES holotrace.simulation_signal(id, session_id)
        ON DELETE CASCADE,
    PRIMARY KEY (sampled_at, session_id, signal_id)
);

CREATE INDEX simulation_sample_signal_time_idx
    ON holotrace.simulation_sample (session_id, signal_id, sampled_at DESC);
```

This is a regular PostgreSQL table. The timestamp participates in the primary key so a signal can retain multiple samples. The secondary index supports fetching a signal in reverse chronological order. Revisit native PostgreSQL partitioning only after measured usage shows it is necessary.

## Saved simulation artifacts

```sql
CREATE TABLE holotrace.simulation_artifact (
    session_id      uuid NOT NULL REFERENCES holotrace.simulation_session(id) ON DELETE CASCADE,
    artifact_id     uuid NOT NULL REFERENCES holotrace.artifact(id) ON DELETE CASCADE,
    purpose         text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (session_id, artifact_id)
);
```

## Row-level security

Do not add permissive placeholder policies. PostgreSQL row-level security becomes default-deny after it is enabled without an applicable policy, and table owners normally bypass it. The final policy design therefore depends on how the API sets a verified user or workspace identity on each database transaction.

Before production, define and test policies for every workspace-owned access path, including indirect access through projects, circuits, recognition jobs, artifacts, and simulation sessions. Service roles used by ML and simulation workers should receive narrowly scoped permissions rather than sharing the application owner's role.

## Invariants requiring follow-up

The first migration design should explicitly decide how to enforce these rules:

- A package and all of its package pins belong to the same component definition.
- Recognition detections and source artifacts belong to the same project or workspace as their circuit.
- Validation targets belong to the referenced circuit version.
- Simulation-signal source objects belong to the session's circuit version.
- Circuit versions become immutable after publication.
- Artifact access cannot cross workspace authorization boundaries.
- Deleting user-facing records does not accidentally erase data that must be retained for audit, billing, or consent history.

Prefer composite foreign keys for structural invariants, database constraints for local value rules, and service-level validation only for truly polymorphic or workflow-dependent rules.

## References

- [PostgreSQL partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
- [PostgreSQL table partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [PostgreSQL JSONB indexing](https://www.postgresql.org/docs/current/datatype-json.html#JSON-INDEXING)
- [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
