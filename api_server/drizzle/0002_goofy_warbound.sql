ALTER TABLE "projects" DROP CONSTRAINT "projects_owner_users_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "owner" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "data" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "name" varchar(120) DEFAULT 'Untitled circuit' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_fk" FOREIGN KEY ("owner") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;