import { relations } from "drizzle-orm";
import {
    pgTable, serial, varchar, timestamp, text
} from "drizzle-orm/pg-core";

import { user as authUser } from "./auth-schema";

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 18 }).unique().notNull(),
    password: varchar("password", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
    id: serial("id").primaryKey(),
    owner: text("owner").notNull().references(() => authUser.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull().default("Untitled circuit"),
    data: text("data").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    modifiedAt: timestamp("modifiedAt").defaultNow().notNull(),
    lastOpenedAt: timestamp("lastOpenedAt").defaultNow().notNull(),
});

export const projectsRelations = relations(projects, ({ one }) => ({
    owner: one(authUser, {
        fields: [projects.owner],
        references: [authUser.id],
    }),
}));
