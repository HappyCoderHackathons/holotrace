// TypeScript — Drizzle ORM schema for Holotrace
//
// Notes on things Drizzle can't express 1:1 with the SQL doc:
//   - `sha256 ~ '^[0-9a-f]{64}$'` and all enum-style `CHECK (... IN (...))`
//     constraints are reproduced with `check()`.
//   - `bigint` uses `{ mode: "number" }` for convenience; switch to
//     `{ mode: "bigint" }` if byte sizes can exceed Number.MAX_SAFE_INTEGER.
//   - Row-level security policies are a service-level/API concern per the
//     doc ("do not add permissive placeholder policies") and are
//     intentionally not modeled here.

import { sql } from "drizzle-orm";
import {
  pgSchema,
  uuid,
  text,
  integer,
  bigint,
  smallint,
  boolean,
  jsonb,
  timestamp,
  doublePrecision,
  primaryKey,
  uniqueIndex,
  index,
  unique,
  check,
  foreignKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const holotrace = pgSchema("holotrace");

// ---------------------------------------------------------------------------
// Accounts, workspaces, and projects
// ---------------------------------------------------------------------------

export const appUser = holotrace.table("app_user", {
  id: uuid("id").primaryKey().defaultRandom(),
  authSubject: text("auth_subject").notNull().unique(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspace = holotrace.table("workspace", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdBy: uuid("created_by").notNull().references(() => appUser.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMember = holotrace.table(
  "workspace_member",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    check("workspace_member_role_check", sql`${t.role} IN ('owner', 'editor', 'viewer')`),
  ],
);

export const project = holotrace.table(
  "project",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdBy: uuid("created_by").notNull().references(() => appUser.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("project_workspace_idx").on(t.workspaceId, t.updatedAt.desc()),
  ],
);

// ---------------------------------------------------------------------------
// Stored artifacts
// ---------------------------------------------------------------------------

export const artifact = holotrace.table(
  "artifact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").references(() => workspace.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    objectKey: text("object_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    licenseId: text("license_id"),
    sourceUri: text("source_uri"),
    provenance: jsonb("provenance").notNull().default({}),
    createdBy: uuid("created_by").references(() => appUser.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("artifact_workspace_kind_idx").on(t.workspaceId, t.kind, t.createdAt.desc()),
    check(
      "artifact_kind_check",
      sql`${t.kind} IN ('source_image', 'processed_image', 'schematic_svg', 'physical_2d', 'model_3d', 'texture', 'firmware', 'waveform', 'other')`,
    ),
    check("artifact_byte_size_check", sql`${t.byteSize} >= 0`),
    check("artifact_sha256_check", sql`${t.sha256} ~ '^[0-9a-f]{64}$'`),
  ],
);

// ---------------------------------------------------------------------------
// Component catalog
// ---------------------------------------------------------------------------

export const componentDefinition = holotrace.table(
  "component_definition",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").references(() => workspace.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    manufacturer: text("manufacturer"),
    manufacturerPart: text("manufacturer_part"),
    description: text("description"),
    properties: jsonb("properties").notNull().default({}),
    catalogVersion: integer("catalog_version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Partial unique indexes: one slug namespace for the shared/global
    // catalog (workspace_id IS NULL), one per-workspace.
    uniqueIndex("component_definition_global_slug_uq")
      .on(t.slug)
      .where(sql`${t.workspaceId} IS NULL`),
    uniqueIndex("component_definition_workspace_slug_uq")
      .on(t.workspaceId, t.slug)
      .where(sql`${t.workspaceId} IS NOT NULL`),
    // GIN index on properties — declared here for documentation; Drizzle's
    // index builder doesn't have a typed `jsonb_path_ops` helper, so this
    // still needs `.using("gin", sql`${t.properties} jsonb_path_ops`)`
    // support in your drizzle-kit version, or a raw migration statement.
    index("component_definition_properties_gin").using("gin", sql`${t.properties} jsonb_path_ops`),
    check("component_definition_catalog_version_check", sql`${t.catalogVersion} > 0`),
  ],
);

export const componentPin = holotrace.table(
  "component_pin",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    componentId: uuid("component_id")
      .notNull()
      .references(() => componentDefinition.id, { onDelete: "cascade" }),
    pinKey: text("pin_key").notNull(),
    name: text("name").notNull(),
    electricalRole: text("electrical_role"),
    ordinal: integer("ordinal").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    unique("component_pin_component_id_pin_key_uq").on(t.componentId, t.pinKey),
    unique("component_pin_component_id_ordinal_uq").on(t.componentId, t.ordinal),
    check("component_pin_ordinal_check", sql`${t.ordinal} >= 0`),
  ],
);

export const componentPackage = holotrace.table(
  "component_package",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    componentId: uuid("component_id")
      .notNull()
      .references(() => componentDefinition.id, { onDelete: "cascade" }),
    packageKey: text("package_key").notNull(),
    name: text("name").notNull(),
    dimensionsMm: jsonb("dimensions_mm").notNull().default({}),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("component_package_component_id_package_key_uq").on(t.componentId, t.packageKey),
    // Needed as the referenced side of composite FKs from component_representation
    // and component_simulation_model.
    unique("component_package_id_component_id_uq").on(t.id, t.componentId),
  ],
);

export const packagePin = holotrace.table(
  "package_pin",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => componentPackage.id, { onDelete: "cascade" }),
    componentPinId: uuid("component_pin_id")
      .notNull()
      .references(() => componentPin.id, { onDelete: "cascade" }),
    physicalLabel: text("physical_label").notNull(),
    anchor2d: jsonb("anchor_2d"),
    anchor3d: jsonb("anchor_3d"),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    unique("package_pin_package_id_component_pin_id_uq").on(t.packageId, t.componentPinId),
    unique("package_pin_package_id_physical_label_uq").on(t.packageId, t.physicalLabel),
    // The service must verify that the package and logical pin belong to
    // the same component until the write model can carry a composite key.
  ],
);

export const componentRepresentation = holotrace.table(
  "component_representation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    componentId: uuid("component_id")
      .notNull()
      .references(() => componentDefinition.id, { onDelete: "cascade" }),
    packageId: uuid("package_id").references(() => componentPackage.id, { onDelete: "cascade" }),
    representationKind: text("representation_kind").notNull(),
    artifactId: uuid("artifact_id").notNull().references(() => artifact.id),
    detailLevel: integer("detail_level").notNull().default(0),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.packageId, t.componentId],
      foreignColumns: [componentPackage.id, componentPackage.componentId],
      name: "component_representation_package_component_fk",
    }),
    unique("component_representation_uq")
      .on(t.componentId, t.packageId, t.representationKind, t.detailLevel)
      .nullsNotDistinct(),
    check(
      "component_representation_kind_check",
      sql`${t.representationKind} IN ('schematic_svg', 'physical_2d', 'model_3d')`,
    ),
    check("component_representation_detail_level_check", sql`${t.detailLevel} >= 0`),
  ],
);

// ---------------------------------------------------------------------------
// Simulation catalog
// ---------------------------------------------------------------------------

export const simulationEngine = holotrace.table(
  "simulation_engine",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    engineKey: text("engine_key").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    capabilities: jsonb("capabilities").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("simulation_engine_engine_key_version_uq").on(t.engineKey, t.version)],
);

export const simulationModel = holotrace.table(
  "simulation_model",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    engineId: uuid("engine_id").notNull().references(() => simulationEngine.id),
    modelKey: text("model_key").notNull(),
    version: integer("version").notNull().default(1),
    definition: text("definition"),
    artifactId: uuid("artifact_id").references(() => artifact.id),
    parameters: jsonb("parameters").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("simulation_model_engine_id_model_key_version_uq").on(t.engineId, t.modelKey, t.version),
    // Needed as the referenced side of the composite FK from
    // component_simulation_model.
    unique("simulation_model_id_engine_id_uq").on(t.id, t.engineId),
    check("simulation_model_version_check", sql`${t.version} > 0`),
    check(
      "simulation_model_definition_or_artifact_check",
      sql`${t.definition} IS NOT NULL OR ${t.artifactId} IS NOT NULL`,
    ),
  ],
);

export const componentSimulationModel = holotrace.table(
  "component_simulation_model",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    componentId: uuid("component_id")
      .notNull()
      .references(() => componentDefinition.id, { onDelete: "cascade" }),
    packageId: uuid("package_id").references(() => componentPackage.id, { onDelete: "cascade" }),
    engineId: uuid("engine_id").notNull().references(() => simulationEngine.id),
    // FK target is the composite (id, engine_id) on simulation_model — see
    // the foreignKey() below, so this column itself carries no single-column
    // `.references()`.
    modelId: uuid("model_id").notNull(),
    pinMapping: jsonb("pin_mapping").notNull(),
    parameterMapping: jsonb("parameter_mapping").notNull().default({}),
    interactionMapping: jsonb("interaction_mapping").notNull().default({}),
    isDefault: boolean("is_default").notNull().default(false),
  },
  (t) => [
    foreignKey({
      columns: [t.modelId, t.engineId],
      foreignColumns: [simulationModel.id, simulationModel.engineId],
      name: "component_simulation_model_model_engine_fk",
    }),
    foreignKey({
      columns: [t.packageId, t.componentId],
      foreignColumns: [componentPackage.id, componentPackage.componentId],
      name: "component_simulation_model_package_component_fk",
    }).onDelete("cascade"),
    unique("component_simulation_model_uq")
      .on(t.componentId, t.packageId, t.modelId)
      .nullsNotDistinct(),
    // Separate nullable and non-null package cases so PostgreSQL cannot
    // accept multiple component-wide defaults because NULLs are distinct.
    uniqueIndex("component_default_simulation_model_for_package_uq")
      .on(t.componentId, t.packageId, t.engineId)
      .where(sql`${t.isDefault} AND ${t.packageId} IS NOT NULL`),
    uniqueIndex("component_default_simulation_model_without_package_uq")
      .on(t.componentId, t.engineId)
      .where(sql`${t.isDefault} AND ${t.packageId} IS NULL`),
  ],
);

// ---------------------------------------------------------------------------
// ML recognition
// ---------------------------------------------------------------------------

export const mlModelVersion = holotrace.table(
  "ml_model_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modelKey: text("model_key").notNull(),
    version: text("version").notNull(),
    artifactId: uuid("artifact_id").references(() => artifact.id),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("ml_model_version_model_key_version_uq").on(t.modelKey, t.version)],
);

export const recognitionJob = holotrace.table(
  "recognition_job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sourceArtifactId: uuid("source_artifact_id").notNull().references(() => artifact.id),
    processedArtifactId: uuid("processed_artifact_id").references(() => artifact.id),
    modelVersionId: uuid("model_version_id").references(() => mlModelVersion.id),
    status: text("status").notNull(),
    preprocessing: jsonb("preprocessing").notNull().default({}),
    rawResult: jsonb("raw_result"),
    error: jsonb("error"),
    requestedBy: uuid("requested_by").notNull().references(() => appUser.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("recognition_job_project_idx").on(t.projectId, t.createdAt.desc()),
    check(
      "recognition_job_status_check",
      sql`${t.status} IN ('queued', 'preprocessing', 'running', 'succeeded', 'failed', 'cancelled')`,
    ),
  ],
);

export const recognitionDetection = holotrace.table(
  "recognition_detection",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recognitionJobId: uuid("recognition_job_id")
      .notNull()
      .references(() => recognitionJob.id, { onDelete: "cascade" }),
    detectionKind: text("detection_kind").notNull(),
    sourceRegion: jsonb("source_region").notNull(),
    recognizedText: text("recognized_text"),
    confidence: doublePrecision("confidence"),
    candidates: jsonb("candidates").notNull().default([]),
    selectedComponentId: uuid("selected_component_id").references(() => componentDefinition.id),
    reviewState: text("review_state").notNull().default("unreviewed"),
    reviewedBy: uuid("reviewed_by").references(() => appUser.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    index("recognition_detection_job_idx").on(t.recognitionJobId, t.detectionKind),
    check(
      "recognition_detection_kind_check",
      sql`${t.detectionKind} IN ('component', 'pin', 'wire', 'junction', 'crossing', 'label', 'other')`,
    ),
    check("recognition_detection_confidence_check", sql`${t.confidence} BETWEEN 0.0 AND 1.0`),
    check(
      "recognition_detection_review_state_check",
      sql`${t.reviewState} IN ('unreviewed', 'accepted', 'corrected', 'rejected')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Circuits and immutable versions
// ---------------------------------------------------------------------------

export const circuit = holotrace.table(
  "circuit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdBy: uuid("created_by").notNull().references(() => appUser.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("circuit_project_idx").on(t.projectId, t.updatedAt.desc())],
);

export const circuitVersion = holotrace.table(
  "circuit_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circuitId: uuid("circuit_id")
      .notNull()
      .references(() => circuit.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    // Self-referencing composite FK (parent_version_id, circuit_id) ->
    // (id, circuit_id) — typed as AnyPgColumn to allow the circular
    // reference to the table currently being defined.
    parentVersionId: uuid("parent_version_id"),
    recognitionJobId: uuid("recognition_job_id").references(() => recognitionJob.id),
    schemaVersion: integer("schema_version").notNull().default(1),
    irSchemaVersion: text("ir_schema_version").notNull().default("circuit-ir-v0"),
    status: text("status").notNull(),
    changeSummary: text("change_summary"),
    createdBy: uuid("created_by").notNull().references(() => appUser.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.parentVersionId, t.circuitId],
      foreignColumns: [t.id, t.circuitId],
      name: "circuit_version_parent_circuit_fk",
    }),
    unique("circuit_version_circuit_id_version_number_uq").on(t.circuitId, t.versionNumber),
    // Needed as the referenced side of composite FKs from every
    // circuit-version-scoped child table below.
    unique("circuit_version_id_circuit_id_uq").on(t.id, t.circuitId),
    check("circuit_version_number_check", sql`${t.versionNumber} > 0`),
    check("circuit_version_schema_version_check", sql`${t.schemaVersion} > 0`),
    check("circuit_version_ir_schema_version_check", sql`length(${t.irSchemaVersion}) > 0`),
    check(
      "circuit_version_status_check",
      sql`${t.status} IN ('recognized', 'needs_review', 'electrically_valid', 'simulatable', 'archived')`,
    ),
  ],
);

export const componentInstance = holotrace.table(
  "component_instance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circuitVersionId: uuid("circuit_version_id")
      .notNull()
      .references(() => circuitVersion.id, { onDelete: "cascade" }),
    componentId: uuid("component_id").references(() => componentDefinition.id),
    packageId: uuid("package_id"),
    sourceDetectionId: uuid("source_detection_id").references(() => recognitionDetection.id),
    referenceDesignator: text("reference_designator").notNull(),
    displayName: text("display_name"),
    properties: jsonb("properties").notNull().default({}),
    recognitionConfidence: doublePrecision("recognition_confidence"),
    resolutionState: text("resolution_state").notNull().default("resolved"),
  },
  (t) => [
    foreignKey({
      columns: [t.packageId, t.componentId],
      foreignColumns: [componentPackage.id, componentPackage.componentId],
      name: "component_instance_package_component_fk",
    }),
    unique("component_instance_circuit_version_id_reference_designator_uq").on(
      t.circuitVersionId,
      t.referenceDesignator,
    ),
    unique("component_instance_id_circuit_version_id_uq").on(t.id, t.circuitVersionId),
    check(
      "component_instance_recognition_confidence_check",
      sql`${t.recognitionConfidence} BETWEEN 0.0 AND 1.0`,
    ),
    check(
      "component_instance_resolution_state_check",
      sql`${t.resolutionState} IN ('resolved', 'inferred', 'ambiguous', 'unknown')`,
    ),
    check(
      "component_instance_package_requires_component_check",
      sql`${t.packageId} IS NULL OR ${t.componentId} IS NOT NULL`,
    ),
  ],
);

export const componentInstancePin = holotrace.table(
  "component_instance_pin",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circuitVersionId: uuid("circuit_version_id")
      .notNull()
      .references(() => circuitVersion.id, { onDelete: "cascade" }),
    componentInstanceId: uuid("component_instance_id").notNull(),
    componentPinId: uuid("component_pin_id").references(() => componentPin.id),
    packagePinId: uuid("package_pin_id").references(() => packagePin.id),
    pinKey: text("pin_key").notNull(),
    displayName: text("display_name"),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    foreignKey({
      columns: [t.componentInstanceId, t.circuitVersionId],
      foreignColumns: [componentInstance.id, componentInstance.circuitVersionId],
      name: "component_instance_pin_instance_circuit_fk",
    }).onDelete("cascade"),
    unique("component_instance_pin_instance_id_pin_key_uq").on(t.componentInstanceId, t.pinKey),
    unique("component_instance_pin_id_circuit_version_id_uq").on(t.id, t.circuitVersionId),
  ],
);

export const net = holotrace.table(
  "net",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circuitVersionId: uuid("circuit_version_id")
      .notNull()
      .references(() => circuitVersion.id, { onDelete: "cascade" }),
    netKey: text("net_key").notNull(),
    name: text("name"),
    kind: text("kind").notNull().default("signal"),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    unique("net_circuit_version_id_net_key_uq").on(t.circuitVersionId, t.netKey),
    unique("net_id_circuit_version_id_uq").on(t.id, t.circuitVersionId),
    check("net_kind_check", sql`${t.kind} IN ('signal', 'power', 'ground', 'unresolved')`),
  ],
);

export const netMember = holotrace.table(
  "net_member",
  {
    circuitVersionId: uuid("circuit_version_id")
      .notNull()
      .references(() => circuitVersion.id, { onDelete: "cascade" }),
    netId: uuid("net_id").notNull(),
    instancePinId: uuid("instance_pin_id").notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.netId, t.circuitVersionId],
      foreignColumns: [net.id, net.circuitVersionId],
      name: "net_member_net_circuit_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.instancePinId, t.circuitVersionId],
      foreignColumns: [componentInstancePin.id, componentInstancePin.circuitVersionId],
      name: "net_member_instance_pin_circuit_fk",
    }).onDelete("cascade"),
    primaryKey({ columns: [t.netId, t.instancePinId] }),
    unique("net_member_circuit_version_id_instance_pin_id_uq").on(t.circuitVersionId, t.instancePinId),
  ],
);

// ---------------------------------------------------------------------------
// Validation issues
// ---------------------------------------------------------------------------

export const validationIssue = holotrace.table(
  "validation_issue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circuitVersionId: uuid("circuit_version_id")
      .notNull()
      .references(() => circuitVersion.id, { onDelete: "cascade" }),
    severity: text("severity").notNull(),
    issueCode: text("issue_code").notNull(),
    message: text("message").notNull(),
    // Intentionally polymorphic (targetKind + targetId) — the app must
    // verify the target belongs to the same circuit version.
    targetKind: text("target_kind"),
    targetId: uuid("target_id"),
    details: jsonb("details").notNull().default({}),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("validation_issue_open_idx")
      .on(t.circuitVersionId, t.severity)
      .where(sql`${t.resolvedAt} IS NULL`),
    check("validation_issue_severity_check", sql`${t.severity} IN ('info', 'warning', 'error')`),
  ],
);

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------

export const circuitLayout = holotrace.table(
  "circuit_layout",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circuitVersionId: uuid("circuit_version_id")
      .notNull()
      .references(() => circuitVersion.id, { onDelete: "cascade" }),
    layoutKind: text("layout_kind").notNull(),
    revision: integer("revision").notNull(),
    generator: text("generator"),
    generatorVersion: text("generator_version"),
    viewport: jsonb("viewport").notNull().default({}),
    metadata: jsonb("metadata").notNull().default({}),
    createdBy: uuid("created_by").references(() => appUser.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("circuit_layout_circuit_version_id_layout_kind_revision_uq").on(
      t.circuitVersionId,
      t.layoutKind,
      t.revision,
    ),
    unique("circuit_layout_id_circuit_version_id_uq").on(t.id, t.circuitVersionId),
    check(
      "circuit_layout_kind_check",
      sql`${t.layoutKind} IN ('schematic_2d', 'physical_2d', 'physical_3d')`,
    ),
    check("circuit_layout_revision_check", sql`${t.revision} > 0`),
  ],
);

export const componentPlacement = holotrace.table(
  "component_placement",
  {
    circuitVersionId: uuid("circuit_version_id")
      .notNull()
      .references(() => circuitVersion.id, { onDelete: "cascade" }),
    layoutId: uuid("layout_id").notNull(),
    componentInstanceId: uuid("component_instance_id").notNull(),
    // Position (2D layouts use x/y; z stays at its default).
    positionX: doublePrecision("position_x").notNull().default(0),
    positionY: doublePrecision("position_y").notNull().default(0),
    positionZ: doublePrecision("position_z").notNull().default(0),
    // Rotation as a quaternion (x, y, z, w) so a single placement can drive
    // a 3D renderer with no Euler-order ambiguity; 2D layouts use rotation
    // around the relevant axis only.
    rotationX: doublePrecision("rotation_x").notNull().default(0),
    rotationY: doublePrecision("rotation_y").notNull().default(0),
    rotationZ: doublePrecision("rotation_z").notNull().default(0),
    rotationW: doublePrecision("rotation_w").notNull().default(1),
    scaleX: doublePrecision("scale_x").notNull().default(1),
    scaleY: doublePrecision("scale_y").notNull().default(1),
    scaleZ: doublePrecision("scale_z").notNull().default(1),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    foreignKey({
      columns: [t.layoutId, t.circuitVersionId],
      foreignColumns: [circuitLayout.id, circuitLayout.circuitVersionId],
      name: "component_placement_layout_circuit_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.componentInstanceId, t.circuitVersionId],
      foreignColumns: [componentInstance.id, componentInstance.circuitVersionId],
      name: "component_placement_instance_circuit_fk",
    }).onDelete("cascade"),
    primaryKey({ columns: [t.layoutId, t.componentInstanceId] }),
  ],
);

export const wireRoute = holotrace.table(
  "wire_route",
  {
    circuitVersionId: uuid("circuit_version_id")
      .notNull()
      .references(() => circuitVersion.id, { onDelete: "cascade" }),
    layoutId: uuid("layout_id").notNull(),
    netId: uuid("net_id").notNull(),
    route: jsonb("route").notNull(),
    style: jsonb("style").notNull().default({}),
  },
  (t) => [
    foreignKey({
      columns: [t.layoutId, t.circuitVersionId],
      foreignColumns: [circuitLayout.id, circuitLayout.circuitVersionId],
      name: "wire_route_layout_circuit_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.netId, t.circuitVersionId],
      foreignColumns: [net.id, net.circuitVersionId],
      name: "wire_route_net_circuit_fk",
    }).onDelete("cascade"),
    primaryKey({ columns: [t.layoutId, t.netId] }),
  ],
);

// ---------------------------------------------------------------------------
// Simulation sessions and signals
// ---------------------------------------------------------------------------

export const simulationSession = holotrace.table(
  "simulation_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circuitVersionId: uuid("circuit_version_id").notNull().references(() => circuitVersion.id),
    engineId: uuid("engine_id").notNull().references(() => simulationEngine.id),
    status: text("status").notNull(),
    configuration: jsonb("configuration").notNull().default({}),
    modelManifest: jsonb("model_manifest").notNull().default({}),
    summary: jsonb("summary"),
    error: jsonb("error"),
    createdBy: uuid("created_by").notNull().references(() => appUser.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("simulation_session_circuit_idx").on(t.circuitVersionId, t.createdAt.desc()),
    check(
      "simulation_session_status_check",
      sql`${t.status} IN ('created', 'running', 'paused', 'completed', 'failed', 'cancelled')`,
    ),
  ],
);

export const simulationSignal = holotrace.table(
  "simulation_signal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => simulationSession.id, { onDelete: "cascade" }),
    signalKey: text("signal_key").notNull(),
    name: text("name").notNull(),
    quantity: text("quantity").notNull(),
    unit: text("unit").notNull(),
    sourceKind: text("source_kind"),
    sourceId: uuid("source_id"),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    unique("simulation_signal_session_id_signal_key_uq").on(t.sessionId, t.signalKey),
    // Needed as the referenced side of the composite FK from
    // simulation_sample.
    unique("simulation_signal_id_session_id_uq").on(t.id, t.sessionId),
  ],
);

// ---------------------------------------------------------------------------
// Sampled simulation values
// ---------------------------------------------------------------------------
// This is an ordinary PostgreSQL table. Only insert selected/downsampled
// output here, not every solver tick. Native partitioning can be introduced
// later if measured usage warrants it.

export const simulationSample = holotrace.table(
  "simulation_sample",
  {
    sampledAt: timestamp("sampled_at", { withTimezone: true }).notNull(),
    sessionId: uuid("session_id").notNull(),
    signalId: uuid("signal_id").notNull(),
    value: doublePrecision("value").notNull(),
    quality: smallint("quality"),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    foreignKey({
      columns: [t.signalId, t.sessionId],
      foreignColumns: [simulationSignal.id, simulationSignal.sessionId],
      name: "simulation_sample_signal_session_fk",
    }).onDelete("cascade"),
    primaryKey({ columns: [t.sampledAt, t.sessionId, t.signalId] }),
    index("simulation_sample_signal_time_idx").on(t.sessionId, t.signalId, t.sampledAt.desc()),
  ],
);

// ---------------------------------------------------------------------------
// Saved simulation artifacts
// ---------------------------------------------------------------------------

export const simulationArtifact = holotrace.table(
  "simulation_artifact",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => simulationSession.id, { onDelete: "cascade" }),
    artifactId: uuid("artifact_id")
      .notNull()
      .references(() => artifact.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.artifactId] })],
);
