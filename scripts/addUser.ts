import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { users } from '../src/db/schema.js'; // Adjust path if your schema is elsewhere
import { eq } from 'drizzle-orm';
import fs from 'fs'; // Added for checking .env.local
import path from 'path'; // Added for resolving path to .env.local

// Load environment variables from .env.local first, then .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  console.log('Loading environment variables from .env.local');
  dotenv.config({ path: envLocalPath });
} else {
  console.log('Loading environment variables from .env (as .env.local was not found)');
  dotenv.config(); // Defaults to .env
}

const main = async () => {
  const email = 'demo@meeting.ai';
  const password = 'MeetingAI2025';
  const fullName = 'Meeting AI';

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const client = postgres(databaseUrl);
  const db = drizzle(client);

  try {
    console.log(`Hashing password for user ${email}...`);
    const saltRounds = 10; // Standard salt rounds for bcrypt
    const passwordHash = bcrypt.hashSync(password, saltRounds);
    console.log('Password hashed.');

    console.log(`Attempting to insert user: ${email}, ${fullName}`);
    
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
      console.warn(`User with email ${email} already exists. Skipping insertion.`);
      return;
    }

    const newUser = await db.insert(users).values({
      email: email,
      passwordHash: passwordHash,
      fullName: fullName,
      // createdAt will be set by defaultNow()
    }).returning({
      id: users.id,
      email: users.email,
      createdAt: users.createdAt
    });

    if (newUser && newUser.length > 0) {
      console.log('Successfully added new user:');
      console.log(newUser[0]);
    } else {
      console.error('Failed to add user. No record returned.');
    }

  } catch (error) {
    console.error('Error adding user to the database:');
    if (error instanceof Error) {
      console.error(error.message);
      if ((error as any).code) { // For pg errors
        console.error(`PG Error Code: ${(error as any).code}`);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  } finally {
    console.log('Closing database connection...');
    await client.end();
    console.log('Database connection closed.');
  }
};

main().catch((err) => {
  console.error("Unhandled error in main function:", err);
  process.exit(1);
}); 