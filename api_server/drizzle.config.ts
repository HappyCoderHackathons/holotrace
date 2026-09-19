import { defineConfig } from "drizzle-kit";

console.log("[*] Starting Drizzle Configuration Defining...")
export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});