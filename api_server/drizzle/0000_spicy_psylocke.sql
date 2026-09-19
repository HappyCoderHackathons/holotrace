CREATE SCHEMA "holotrace";
--> statement-breakpoint
CREATE TABLE "holotrace"."app_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_subject" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_auth_subject_unique" UNIQUE("auth_subject")
);
--> statement-breakpoint
CREATE TABLE "holotrace"."artifact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"kind" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"sha256" text NOT NULL,
	"license_id" text,
	"source_uri" text,
	"provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artifact_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "artifact_kind_check" CHECK ("holotrace"."artifact"."kind" IN ('source_image', 'processed_image', 'schematic_svg', 'physical_2d', 'model_3d', 'texture', 'firmware', 'waveform', 'other')),
	CONSTRAINT "artifact_byte_size_check" CHECK ("holotrace"."artifact"."byte_size" >= 0),
	CONSTRAINT "artifact_sha256_check" CHECK ("holotrace"."artifact"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "holotrace"."circuit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holotrace"."circuit_layout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circuit_version_id" uuid NOT NULL,
	"layout_kind" text NOT NULL,
	"revision" integer NOT NULL,
	"generator" text,
	"generator_version" text,
	"viewport" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circuit_layout_circuit_version_id_layout_kind_revision_uq" UNIQUE("circuit_version_id","layout_kind","revision"),
	CONSTRAINT "circuit_layout_id_circuit_version_id_uq" UNIQUE("id","circuit_version_id"),
	CONSTRAINT "circuit_layout_kind_check" CHECK ("holotrace"."circuit_layout"."layout_kind" IN ('schematic_2d', 'physical_2d', 'physical_3d')),
	CONSTRAINT "circuit_layout_revision_check" CHECK ("holotrace"."circuit_layout"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "holotrace"."circuit_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circuit_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"parent_version_id" uuid,
	"recognition_job_id" uuid,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"status" text NOT NULL,
	"change_summary" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circuit_version_circuit_id_version_number_uq" UNIQUE("circuit_id","version_number"),
	CONSTRAINT "circuit_version_id_circuit_id_uq" UNIQUE("id","circuit_id"),
	CONSTRAINT "circuit_version_number_check" CHECK ("holotrace"."circuit_version"."version_number" > 0),
	CONSTRAINT "circuit_version_schema_version_check" CHECK ("holotrace"."circuit_version"."schema_version" > 0),
	CONSTRAINT "circuit_version_status_check" CHECK ("holotrace"."circuit_version"."status" IN ('recognized', 'needs_review', 'electrically_valid', 'simulatable', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "holotrace"."component_definition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"manufacturer" text,
	"manufacturer_part" text,
	"description" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"catalog_version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_definition_catalog_version_check" CHECK ("holotrace"."component_definition"."catalog_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "holotrace"."component_instance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circuit_version_id" uuid NOT NULL,
	"component_id" uuid,
	"package_id" uuid,
	"source_detection_id" uuid,
	"reference_designator" text NOT NULL,
	"display_name" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recognition_confidence" double precision,
	"resolution_state" text DEFAULT 'resolved' NOT NULL,
	CONSTRAINT "component_instance_circuit_version_id_reference_designator_uq" UNIQUE("circuit_version_id","reference_designator"),
	CONSTRAINT "component_instance_id_circuit_version_id_uq" UNIQUE("id","circuit_version_id"),
	CONSTRAINT "component_instance_recognition_confidence_check" CHECK ("holotrace"."component_instance"."recognition_confidence" BETWEEN 0.0 AND 1.0),
	CONSTRAINT "component_instance_resolution_state_check" CHECK ("holotrace"."component_instance"."resolution_state" IN ('resolved', 'inferred', 'ambiguous', 'unknown'))
);
--> statement-breakpoint
CREATE TABLE "holotrace"."component_instance_pin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circuit_version_id" uuid NOT NULL,
	"component_instance_id" uuid NOT NULL,
	"component_pin_id" uuid,
	"package_pin_id" uuid,
	"pin_key" text NOT NULL,
	"display_name" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "component_instance_pin_instance_id_pin_key_uq" UNIQUE("component_instance_id","pin_key"),
	CONSTRAINT "component_instance_pin_id_circuit_version_id_uq" UNIQUE("id","circuit_version_id")
);
--> statement-breakpoint
CREATE TABLE "holotrace"."component_package" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" uuid NOT NULL,
	"package_key" text NOT NULL,
	"name" text NOT NULL,
	"dimensions_mm" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_package_component_id_package_key_uq" UNIQUE("component_id","package_key"),
	CONSTRAINT "component_package_id_component_id_uq" UNIQUE("id","component_id")
);
--> statement-breakpoint
CREATE TABLE "holotrace"."component_pin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" uuid NOT NULL,
	"pin_key" text NOT NULL,
	"name" text NOT NULL,
	"electrical_role" text,
	"ordinal" integer NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "component_pin_component_id_pin_key_uq" UNIQUE("component_id","pin_key"),
	CONSTRAINT "component_pin_component_id_ordinal_uq" UNIQUE("component_id","ordinal"),
	CONSTRAINT "component_pin_ordinal_check" CHECK ("holotrace"."component_pin"."ordinal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "holotrace"."component_placement" (
	"circuit_version_id" uuid NOT NULL,
	"layout_id" uuid NOT NULL,
	"component_instance_id" uuid NOT NULL,
	"position_x" double precision DEFAULT 0 NOT NULL,
	"position_y" double precision DEFAULT 0 NOT NULL,
	"position_z" double precision DEFAULT 0 NOT NULL,
	"rotation_x" double precision DEFAULT 0 NOT NULL,
	"rotation_y" double precision DEFAULT 0 NOT NULL,
	"rotation_z" double precision DEFAULT 0 NOT NULL,
	"rotation_w" double precision DEFAULT 1 NOT NULL,
	"scale_x" double precision DEFAULT 1 NOT NULL,
	"scale_y" double precision DEFAULT 1 NOT NULL,
	"scale_z" double precision DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "component_placement_layout_id_component_instance_id_pk" PRIMARY KEY("layout_id","component_instance_id")
);
--> statement-breakpoint
CREATE TABLE "holotrace"."component_representation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" uuid NOT NULL,
	"package_id" uuid,
	"representation_kind" text NOT NULL,
	"artifact_id" uuid NOT NULL,
	"detail_level" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_representation_uq" UNIQUE NULLS NOT DISTINCT("component_id","package_id","representation_kind","detail_level"),
	CONSTRAINT "component_representation_kind_check" CHECK ("holotrace"."component_representation"."representation_kind" IN ('schematic_svg', 'physical_2d', 'model_3d')),
	CONSTRAINT "component_representation_detail_level_check" CHECK ("holotrace"."component_representation"."detail_level" >= 0)
);
--> statement-breakpoint
CREATE TABLE "holotrace"."component_simulation_model" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" uuid NOT NULL,
	"package_id" uuid,
	"engine_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"pin_mapping" jsonb NOT NULL,
	"parameter_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"interaction_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	CONSTRAINT "component_simulation_model_uq" UNIQUE NULLS NOT DISTINCT("component_id","package_id","model_id")
);
--> statement-breakpoint
CREATE TABLE "holotrace"."ml_model_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_key" text NOT NULL,
	"version" text NOT NULL,
	"artifact_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ml_model_version_model_key_version_uq" UNIQUE("model_key","version")
);
--> statement-breakpoint
CREATE TABLE "holotrace"."net" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circuit_version_id" uuid NOT NULL,
	"net_key" text NOT NULL,
	"name" text,
	"kind" text DEFAULT 'signal' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "net_circuit_version_id_net_key_uq" UNIQUE("circuit_version_id","net_key"),
	CONSTRAINT "net_id_circuit_version_id_uq" UNIQUE("id","circuit_version_id"),
	CONSTRAINT "net_kind_check" CHECK ("holotrace"."net"."kind" IN ('signal', 'power', 'ground', 'unresolved'))
);
--> statement-breakpoint
CREATE TABLE "holotrace"."net_member" (
	"circuit_version_id" uuid NOT NULL,
	"net_id" uuid NOT NULL,
	"instance_pin_id" uuid NOT NULL,
	CONSTRAINT "net_member_net_id_instance_pin_id_pk" PRIMARY KEY("net_id","instance_pin_id"),
	CONSTRAINT "net_member_circuit_version_id_instance_pin_id_uq" UNIQUE("circuit_version_id","instance_pin_id")
);
--> statement-breakpoint
CREATE TABLE "holotrace"."package_pin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"component_pin_id" uuid NOT NULL,
	"physical_label" text NOT NULL,
	"anchor_2d" jsonb,
	"anchor_3d" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "package_pin_package_id_component_pin_id_uq" UNIQUE("package_id","component_pin_id"),
	CONSTRAINT "package_pin_package_id_physical_label_uq" UNIQUE("package_id","physical_label")
);
--> statement-breakpoint
CREATE TABLE "holotrace"."project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holotrace"."recognition_detection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recognition_job_id" uuid NOT NULL,
	"detection_kind" text NOT NULL,
	"source_region" jsonb NOT NULL,
	"recognized_text" text,
	"confidence" double precision,
	"candidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"selected_component_id" uuid,
	"review_state" text DEFAULT 'unreviewed' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "recognition_detection_kind_check" CHECK ("holotrace"."recognition_detection"."detection_kind" IN ('component', 'pin', 'wire', 'junction', 'crossing', 'label', 'other')),
	CONSTRAINT "recognition_detection_confidence_check" CHECK ("holotrace"."recognition_detection"."confidence" BETWEEN 0.0 AND 1.0),
	CONSTRAINT "recognition_detection_review_state_check" CHECK ("holotrace"."recognition_detection"."review_state" IN ('unreviewed', 'accepted', 'corrected', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "holotrace"."recognition_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_artifact_id" uuid NOT NULL,
	"processed_artifact_id" uuid,
	"model_version_id" uuid,
	"status" text NOT NULL,
	"preprocessing" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw_result" jsonb,
	"error" jsonb,
	"requested_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "recognition_job_status_check" CHECK ("holotrace"."recognition_job"."status" IN ('queued', 'preprocessing', 'running', 'succeeded', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "holotrace"."simulation_artifact" (
	"session_id" uuid NOT NULL,
	"artifact_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "simulation_artifact_session_id_artifact_id_pk" PRIMARY KEY("session_id","artifact_id")
);
--> statement-breakpoint
CREATE TABLE "holotrace"."simulation_engine" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engine_key" text NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "simulation_engine_engine_key_version_uq" UNIQUE("engine_key","version")
);
--> statement-breakpoint
CREATE TABLE "holotrace"."simulation_model" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engine_id" uuid NOT NULL,
	"model_key" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"definition" text,
	"artifact_id" uuid,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "simulation_model_engine_id_model_key_version_uq" UNIQUE("engine_id","model_key","version"),
	CONSTRAINT "simulation_model_id_engine_id_uq" UNIQUE("id","engine_id"),
	CONSTRAINT "simulation_model_version_check" CHECK ("holotrace"."simulation_model"."version" > 0),
	CONSTRAINT "simulation_model_definition_or_artifact_check" CHECK ("holotrace"."simulation_model"."definition" IS NOT NULL OR "holotrace"."simulation_model"."artifact_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "holotrace"."simulation_sample" (
	"sampled_at" timestamp with time zone NOT NULL,
	"session_id" uuid NOT NULL,
	"signal_id" uuid NOT NULL,
	"value" double precision NOT NULL,
	"quality" smallint,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "simulation_sample_sampled_at_session_id_signal_id_pk" PRIMARY KEY("sampled_at","session_id","signal_id")
);
--> statement-breakpoint
CREATE TABLE "holotrace"."simulation_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circuit_version_id" uuid NOT NULL,
	"engine_id" uuid NOT NULL,
	"status" text NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"model_manifest" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" jsonb,
	"error" jsonb,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "simulation_session_status_check" CHECK ("holotrace"."simulation_session"."status" IN ('created', 'running', 'paused', 'completed', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "holotrace"."simulation_signal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"signal_key" text NOT NULL,
	"name" text NOT NULL,
	"quantity" text NOT NULL,
	"unit" text NOT NULL,
	"source_kind" text,
	"source_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "simulation_signal_session_id_signal_key_uq" UNIQUE("session_id","signal_key"),
	CONSTRAINT "simulation_signal_id_session_id_uq" UNIQUE("id","session_id")
);
--> statement-breakpoint
CREATE TABLE "holotrace"."validation_issue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circuit_version_id" uuid NOT NULL,
	"severity" text NOT NULL,
	"issue_code" text NOT NULL,
	"message" text NOT NULL,
	"target_kind" text,
	"target_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "validation_issue_severity_check" CHECK ("holotrace"."validation_issue"."severity" IN ('info', 'warning', 'error'))
);
--> statement-breakpoint
CREATE TABLE "holotrace"."wire_route" (
	"circuit_version_id" uuid NOT NULL,
	"layout_id" uuid NOT NULL,
	"net_id" uuid NOT NULL,
	"route" jsonb NOT NULL,
	"style" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "wire_route_layout_id_net_id_pk" PRIMARY KEY("layout_id","net_id")
);
--> statement-breakpoint
CREATE TABLE "holotrace"."workspace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holotrace"."workspace_member" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_member_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id"),
	CONSTRAINT "workspace_member_role_check" CHECK ("holotrace"."workspace_member"."role" IN ('owner', 'editor', 'viewer'))
);
--> statement-breakpoint
ALTER TABLE "holotrace"."artifact" ADD CONSTRAINT "artifact_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "holotrace"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."artifact" ADD CONSTRAINT "artifact_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "holotrace"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."circuit" ADD CONSTRAINT "circuit_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "holotrace"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."circuit" ADD CONSTRAINT "circuit_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "holotrace"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."circuit_layout" ADD CONSTRAINT "circuit_layout_circuit_version_id_circuit_version_id_fk" FOREIGN KEY ("circuit_version_id") REFERENCES "holotrace"."circuit_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."circuit_layout" ADD CONSTRAINT "circuit_layout_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "holotrace"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."circuit_version" ADD CONSTRAINT "circuit_version_circuit_id_circuit_id_fk" FOREIGN KEY ("circuit_id") REFERENCES "holotrace"."circuit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."circuit_version" ADD CONSTRAINT "circuit_version_recognition_job_id_recognition_job_id_fk" FOREIGN KEY ("recognition_job_id") REFERENCES "holotrace"."recognition_job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."circuit_version" ADD CONSTRAINT "circuit_version_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "holotrace"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."circuit_version" ADD CONSTRAINT "circuit_version_parent_circuit_fk" FOREIGN KEY ("parent_version_id","circuit_id") REFERENCES "holotrace"."circuit_version"("id","circuit_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_definition" ADD CONSTRAINT "component_definition_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "holotrace"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_instance" ADD CONSTRAINT "component_instance_circuit_version_id_circuit_version_id_fk" FOREIGN KEY ("circuit_version_id") REFERENCES "holotrace"."circuit_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_instance" ADD CONSTRAINT "component_instance_component_id_component_definition_id_fk" FOREIGN KEY ("component_id") REFERENCES "holotrace"."component_definition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_instance" ADD CONSTRAINT "component_instance_package_id_component_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "holotrace"."component_package"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_instance" ADD CONSTRAINT "component_instance_source_detection_id_recognition_detection_id_fk" FOREIGN KEY ("source_detection_id") REFERENCES "holotrace"."recognition_detection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_instance_pin" ADD CONSTRAINT "component_instance_pin_circuit_version_id_circuit_version_id_fk" FOREIGN KEY ("circuit_version_id") REFERENCES "holotrace"."circuit_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_instance_pin" ADD CONSTRAINT "component_instance_pin_component_pin_id_component_pin_id_fk" FOREIGN KEY ("component_pin_id") REFERENCES "holotrace"."component_pin"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_instance_pin" ADD CONSTRAINT "component_instance_pin_package_pin_id_package_pin_id_fk" FOREIGN KEY ("package_pin_id") REFERENCES "holotrace"."package_pin"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_instance_pin" ADD CONSTRAINT "component_instance_pin_instance_circuit_fk" FOREIGN KEY ("component_instance_id","circuit_version_id") REFERENCES "holotrace"."component_instance"("id","circuit_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_package" ADD CONSTRAINT "component_package_component_id_component_definition_id_fk" FOREIGN KEY ("component_id") REFERENCES "holotrace"."component_definition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_pin" ADD CONSTRAINT "component_pin_component_id_component_definition_id_fk" FOREIGN KEY ("component_id") REFERENCES "holotrace"."component_definition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_placement" ADD CONSTRAINT "component_placement_circuit_version_id_circuit_version_id_fk" FOREIGN KEY ("circuit_version_id") REFERENCES "holotrace"."circuit_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_placement" ADD CONSTRAINT "component_placement_layout_circuit_fk" FOREIGN KEY ("layout_id","circuit_version_id") REFERENCES "holotrace"."circuit_layout"("id","circuit_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_placement" ADD CONSTRAINT "component_placement_instance_circuit_fk" FOREIGN KEY ("component_instance_id","circuit_version_id") REFERENCES "holotrace"."component_instance"("id","circuit_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_representation" ADD CONSTRAINT "component_representation_component_id_component_definition_id_fk" FOREIGN KEY ("component_id") REFERENCES "holotrace"."component_definition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_representation" ADD CONSTRAINT "component_representation_package_id_component_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "holotrace"."component_package"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_representation" ADD CONSTRAINT "component_representation_artifact_id_artifact_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "holotrace"."artifact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_representation" ADD CONSTRAINT "component_representation_package_component_fk" FOREIGN KEY ("package_id","component_id") REFERENCES "holotrace"."component_package"("id","component_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_simulation_model" ADD CONSTRAINT "component_simulation_model_component_id_component_definition_id_fk" FOREIGN KEY ("component_id") REFERENCES "holotrace"."component_definition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_simulation_model" ADD CONSTRAINT "component_simulation_model_package_id_component_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "holotrace"."component_package"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_simulation_model" ADD CONSTRAINT "component_simulation_model_engine_id_simulation_engine_id_fk" FOREIGN KEY ("engine_id") REFERENCES "holotrace"."simulation_engine"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."component_simulation_model" ADD CONSTRAINT "component_simulation_model_model_engine_fk" FOREIGN KEY ("model_id","engine_id") REFERENCES "holotrace"."simulation_model"("id","engine_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."ml_model_version" ADD CONSTRAINT "ml_model_version_artifact_id_artifact_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "holotrace"."artifact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."net" ADD CONSTRAINT "net_circuit_version_id_circuit_version_id_fk" FOREIGN KEY ("circuit_version_id") REFERENCES "holotrace"."circuit_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."net_member" ADD CONSTRAINT "net_member_circuit_version_id_circuit_version_id_fk" FOREIGN KEY ("circuit_version_id") REFERENCES "holotrace"."circuit_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."net_member" ADD CONSTRAINT "net_member_net_circuit_fk" FOREIGN KEY ("net_id","circuit_version_id") REFERENCES "holotrace"."net"("id","circuit_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."net_member" ADD CONSTRAINT "net_member_instance_pin_circuit_fk" FOREIGN KEY ("instance_pin_id","circuit_version_id") REFERENCES "holotrace"."component_instance_pin"("id","circuit_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."package_pin" ADD CONSTRAINT "package_pin_package_id_component_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "holotrace"."component_package"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."package_pin" ADD CONSTRAINT "package_pin_component_pin_id_component_pin_id_fk" FOREIGN KEY ("component_pin_id") REFERENCES "holotrace"."component_pin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."project" ADD CONSTRAINT "project_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "holotrace"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."project" ADD CONSTRAINT "project_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "holotrace"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."recognition_detection" ADD CONSTRAINT "recognition_detection_recognition_job_id_recognition_job_id_fk" FOREIGN KEY ("recognition_job_id") REFERENCES "holotrace"."recognition_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."recognition_detection" ADD CONSTRAINT "recognition_detection_selected_component_id_component_definition_id_fk" FOREIGN KEY ("selected_component_id") REFERENCES "holotrace"."component_definition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."recognition_detection" ADD CONSTRAINT "recognition_detection_reviewed_by_app_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "holotrace"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."recognition_job" ADD CONSTRAINT "recognition_job_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "holotrace"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."recognition_job" ADD CONSTRAINT "recognition_job_source_artifact_id_artifact_id_fk" FOREIGN KEY ("source_artifact_id") REFERENCES "holotrace"."artifact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."recognition_job" ADD CONSTRAINT "recognition_job_processed_artifact_id_artifact_id_fk" FOREIGN KEY ("processed_artifact_id") REFERENCES "holotrace"."artifact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."recognition_job" ADD CONSTRAINT "recognition_job_model_version_id_ml_model_version_id_fk" FOREIGN KEY ("model_version_id") REFERENCES "holotrace"."ml_model_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."recognition_job" ADD CONSTRAINT "recognition_job_requested_by_app_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "holotrace"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."simulation_artifact" ADD CONSTRAINT "simulation_artifact_session_id_simulation_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "holotrace"."simulation_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."simulation_artifact" ADD CONSTRAINT "simulation_artifact_artifact_id_artifact_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "holotrace"."artifact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."simulation_model" ADD CONSTRAINT "simulation_model_engine_id_simulation_engine_id_fk" FOREIGN KEY ("engine_id") REFERENCES "holotrace"."simulation_engine"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."simulation_model" ADD CONSTRAINT "simulation_model_artifact_id_artifact_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "holotrace"."artifact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."simulation_sample" ADD CONSTRAINT "simulation_sample_signal_session_fk" FOREIGN KEY ("signal_id","session_id") REFERENCES "holotrace"."simulation_signal"("id","session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."simulation_session" ADD CONSTRAINT "simulation_session_circuit_version_id_circuit_version_id_fk" FOREIGN KEY ("circuit_version_id") REFERENCES "holotrace"."circuit_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."simulation_session" ADD CONSTRAINT "simulation_session_engine_id_simulation_engine_id_fk" FOREIGN KEY ("engine_id") REFERENCES "holotrace"."simulation_engine"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."simulation_session" ADD CONSTRAINT "simulation_session_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "holotrace"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."simulation_signal" ADD CONSTRAINT "simulation_signal_session_id_simulation_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "holotrace"."simulation_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."validation_issue" ADD CONSTRAINT "validation_issue_circuit_version_id_circuit_version_id_fk" FOREIGN KEY ("circuit_version_id") REFERENCES "holotrace"."circuit_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."wire_route" ADD CONSTRAINT "wire_route_circuit_version_id_circuit_version_id_fk" FOREIGN KEY ("circuit_version_id") REFERENCES "holotrace"."circuit_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."wire_route" ADD CONSTRAINT "wire_route_layout_circuit_fk" FOREIGN KEY ("layout_id","circuit_version_id") REFERENCES "holotrace"."circuit_layout"("id","circuit_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."wire_route" ADD CONSTRAINT "wire_route_net_circuit_fk" FOREIGN KEY ("net_id","circuit_version_id") REFERENCES "holotrace"."net"("id","circuit_version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."workspace" ADD CONSTRAINT "workspace_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "holotrace"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."workspace_member" ADD CONSTRAINT "workspace_member_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "holotrace"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holotrace"."workspace_member" ADD CONSTRAINT "workspace_member_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "holotrace"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifact_workspace_kind_idx" ON "holotrace"."artifact" USING btree ("workspace_id","kind","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "circuit_project_idx" ON "holotrace"."circuit" USING btree ("project_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "component_definition_global_slug_uq" ON "holotrace"."component_definition" USING btree ("slug") WHERE "holotrace"."component_definition"."workspace_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "component_definition_workspace_slug_uq" ON "holotrace"."component_definition" USING btree ("workspace_id","slug") WHERE "holotrace"."component_definition"."workspace_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "component_definition_properties_gin" ON "holotrace"."component_definition" USING gin ("properties" jsonb_path_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "component_default_simulation_model_uq" ON "holotrace"."component_simulation_model" USING btree ("component_id","package_id","engine_id") WHERE "holotrace"."component_simulation_model"."is_default";--> statement-breakpoint
CREATE INDEX "project_workspace_idx" ON "holotrace"."project" USING btree ("workspace_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recognition_detection_job_idx" ON "holotrace"."recognition_detection" USING btree ("recognition_job_id","detection_kind");--> statement-breakpoint
CREATE INDEX "recognition_job_project_idx" ON "holotrace"."recognition_job" USING btree ("project_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "simulation_sample_signal_time_idx" ON "holotrace"."simulation_sample" USING btree ("session_id","signal_id","sampled_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "simulation_session_circuit_idx" ON "holotrace"."simulation_session" USING btree ("circuit_version_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "validation_issue_open_idx" ON "holotrace"."validation_issue" USING btree ("circuit_version_id","severity") WHERE "holotrace"."validation_issue"."resolved_at" IS NULL;