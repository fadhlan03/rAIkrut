import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv"; // Recommended for loading .env file

// Load environment variables from .env file
dotenv.config({ path: '.env' }); // Adjust path if your .env is elsewhere

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle", // Output directory for migrations
  dialect: "postgresql", // Changed from driver: "pg"
  dbCredentials: {
    // You can leave these blank if you're only generating SQL
    // and not pushing directly to a database from drizzle-kit.
    // However, providing them can be useful for other drizzle-kit commands.
    host: process.env.DB_HOST!,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME!,
    // ssl: process.env.DB_SSL === 'true', // Example for handling boolean SSL
  },
  verbose: true,
  strict: true,
} satisfies Config; 