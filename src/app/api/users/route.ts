import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// GET /api/users - Get all users
export async function GET() {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        created_at: users.createdAt,
        email: users.email,
        full_name: users.fullName,
        type: users.type,
      })
      .from(users)
      .orderBy(users.createdAt);

    return NextResponse.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { full_name, email, type, password } = body;

    // Validation
    if (!full_name || !email || !type || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: full_name, email, type, and password are required' },
        { status: 400 }
      );
    }

    if (!['admin', 'applicant'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid user type. Must be "admin" or "applicant"' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const newUser = await db
      .insert(users)
      .values({
        fullName: full_name,
        email: email,
        type: type,
        passwordHash: hashedPassword,
      })
      .returning({
        id: users.id,
        created_at: users.createdAt,
        email: users.email,
        full_name: users.fullName,
        type: users.type,
      });

    return NextResponse.json(newUser[0], { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
} 