import { adminDb } from "../admin-db";

/**
 * Migration: Add avatarUrl field to users table
 */
export function addAvatarToUsers() {
  try {
    // Check if column already exists
    const columns = adminDb.prepare("PRAGMA table_info(users)").all() as any[];
    const hasAvatarUrl = columns.some((col) => col.name === "avatarUrl");

    if (!hasAvatarUrl) {
      console.log("[Migration] Adding avatarUrl column to users table...");
      adminDb.prepare("ALTER TABLE users ADD COLUMN avatarUrl TEXT").run();
      console.log("[Migration] avatarUrl column added successfully");
    } else {
      console.log("[Migration] avatarUrl column already exists");
    }
  } catch (error) {
    console.error("[Migration] Error adding avatarUrl column:", error);
  }
}
