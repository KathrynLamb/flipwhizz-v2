import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { Resend } from "resend";
import { getPostHogClient } from "@/lib/posthog-server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("REGISTER BODY:", body);
    const { name, email, password } = body;

    // ── Validation ──
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const trimmedEmail = email.toLowerCase().trim();
    const trimmedName = name?.trim() || null;

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // ── Check for existing user ──
    const existing = await db
      .select({ id: users.id, hashedPassword: users.hashedPassword })
      .from(users)
      .where(eq(users.email, trimmedEmail))
      .then((r) => r[0]);

    if (existing) {
      // User exists with a password → they already have an account
      if (existing.hashedPassword) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in." },
          { status: 409 }
        );
      }

      // User exists from Google OAuth but no password → let them add one
      const hashedPassword = await bcrypt.hash(password, 12);
      await db
        .update(users)
        .set({ hashedPassword, name: trimmedName || undefined })
        .where(eq(users.id, existing.id));

      return NextResponse.json({ ok: true, linked: true, userId: existing.id });
    }

    // ── Create new user ──
    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = crypto.randomUUID();

    await db.insert(users).values({
      id: userId,
      email: trimmedEmail,
      name: trimmedName,
      hashedPassword,
    });

    // ── Track registration ──
    const posthog = getPostHogClient();
    posthog.identify({ distinctId: userId, properties: { email: trimmedEmail, name: trimmedName } });
    posthog.capture({ distinctId: userId, event: "user_registered", properties: { email: trimmedEmail, name: trimmedName, method: "email" } });
    await posthog.shutdown();

    // ── Send welcome email (non-blocking) ──
    resend
      .emails.send({
        from: "FlipWhizz <hello@flipwhizz.com>",
        to: trimmedEmail,
        subject: "Welcome to FlipWhizz! 🎨",
        html: `
          <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #2D2235; font-size: 28px;">Welcome${trimmedName ? `, ${trimmedName}` : ""}!</h1>
            <p style="color: #6B5D52; font-size: 16px; line-height: 1.6;">
              You're all set to start creating personalised stories for your little ones.
            </p>
            <p style="color: #6B5D52; font-size: 16px; line-height: 1.6;">
              Your first illustrated spread is free — no strings attached.
            </p>
            <a href="https://flipwhizz.com/projects/new"
               style="display: inline-block; background: #D94590; color: white; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 16px;">
              Create Your First Story
            </a>
            <p style="color: #A89B8E; font-size: 13px; margin-top: 32px;">
              FlipWhizz · Every story finds its way
            </p>
          </div>
        `,
      })
      .catch((err) => console.error("Welcome email failed:", err));

    return NextResponse.json({ ok: true, userId });
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}