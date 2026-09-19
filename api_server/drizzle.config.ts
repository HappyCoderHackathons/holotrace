import { defineConfig } from "drizzle-kit";

console.log("[*] Starting Drizzle Configuration Defining...")
export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        host: process.env.PG_HOST!,
        port: 5432,
        user: process.env.PG_USER!,
        password: process.env.PG_PASSWORD!,
        database: process.env.PG_DATABASE!,
        ssl: false
    }
});