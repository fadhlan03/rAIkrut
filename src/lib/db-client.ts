import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/db/schema';

// Create PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: 'resume_ai_db',
  password: process.env.DB_PASSWORD,
  port: 5432,
});

// Create Drizzle ORM instance with the pool and schema
export const db = drizzle(pool, { schema });
