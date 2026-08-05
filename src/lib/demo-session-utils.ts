// /lib/demo-session-utils.ts
// Client-side utility for managing demo chat sessions

const DEMO_SESSION_STORAGE_KEY = "flipwhizz_demo_session_id";

/**
 * Generate a UUID v4 (client-side, no external dep needed)
 * This creates a valid UUID that will be stored in chatSessions.id
 */
function generateUUID(): string {
  // UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create a demo session ID. Persists in localStorage.
 * This ID is a valid UUID that becomes chatSessions.id in the database.
 */
export function getDemoSessionId(): string {
  // Check if we already have one in storage
  if (typeof window !== "undefined") {
    const existing = localStorage.getItem(DEMO_SESSION_STORAGE_KEY);
    if (existing) {
      return existing;
    }
  }

  // Create a new UUID
  const newId = generateUUID();

  if (typeof window !== "undefined") {
    localStorage.setItem(DEMO_SESSION_STORAGE_KEY, newId);
  }

  return newId;
}

/**
 * Clear the demo session ID after migration to user account.
 */
export function clearDemoSessionId(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
  }
}

/**
 * Call this immediately after the user successfully signs in.
 * Migrates their demo messages to their new authenticated account.
 */
export async function migrateDemoToUserAccount(): Promise<void> {
  const demoSessionId = localStorage.getItem(DEMO_SESSION_STORAGE_KEY);

  if (!demoSessionId) {
    return; // No demo session to migrate
  }

  try {
    const response = await fetch("/api/auth/migrate-demo-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demoSessionId }),
    });

    if (!response.ok) {
      console.warn("Migration response:", response.status);
      return;
    }

    console.log("[demo-migration] Successfully migrated to user account");
    clearDemoSessionId();
  } catch (error) {
    console.error("[demo-migration] failed:", error);
    // Don't throw—let the sign-in complete; migration is best-effort
  }
}