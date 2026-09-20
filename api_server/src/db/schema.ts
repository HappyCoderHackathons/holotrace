import { relations } from "drizzle-orm";
import {
    pgTable, serial, integer, varchar, timestamp, text
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 18 }).unique().notNull(),
    password: varchar("password", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
    id: serial("id").primaryKey(),
    owner: integer("owner").notNull().references(() => users.id), // serial isnt allowed here and its flipping stupid >:(
    data: text("data").notNull().default(""), // json object string -> JSON.parse("{'name':'holotrace'}")
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    modifiedAt: timestamp("modifiedAt").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
    projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
    owner: one(users, {
        fields: [projects.owner],
        references: [users.id],
    }),
}));