import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// POST /api/auth/register - Register a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { full_name, email, password } = body;

    // Validation
    if (!full_name || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: full_name, email, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with 'applicant' type by default
    const newUser = await db
      .insert(users)
      .values({
        fullName: full_name.trim(),
        email: email.toLowerCase().trim(),
        type: 'applicant', // Default to applicant for registrations
        passwordHash: hashedPassword,
      })
      .returning({
        id: users.id,
        created_at: users.createdAt,
        email: users.email,
        full_name: users.fullName,
        type: users.type,
      });

    // Don't return password hash or other sensitive data
    const { ...userResponse } = newUser[0];

    return NextResponse.json(
      { 
        message: 'Account created successfully',
        user: userResponse 
      }, 
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user account:', error);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
} 