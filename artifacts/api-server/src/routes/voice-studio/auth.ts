import { getAuth, clerkClient } from "@clerk/express";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, voiceStudioUsersTable } from "@workspace/db";
import type { VoiceStudioUser } from "@workspace/db";

function getProfileName(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

/**
 * Maps a verified Clerk session to the app's account. Existing app users are
 * resolved by their Clerk ID; invited users are activated by matching the
 * verified email on their Clerk profile. The configured admin email is the
 * only path that can bootstrap the first administrator.
 */
export async function getSignedInAccount(
  req: Request,
  res: Response,
): Promise<VoiceStudioUser | null> {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return null;
  }

  const [linkedAccount] = await db
    .select()
    .from(voiceStudioUsersTable)
    .where(eq(voiceStudioUsersTable.clerkUserId, userId))
    .limit(1);

  if (linkedAccount) {
    if (linkedAccount.status === "pending") {
      const [activated] = await db
        .update(voiceStudioUsersTable)
        .set({ status: "active" })
        .where(eq(voiceStudioUsersTable.id, linkedAccount.id))
        .returning();
      return activated ?? linkedAccount;
    }
    return linkedAccount;
  }

  const identity = await clerkClient.users.getUser(userId);
  const verifiedEmails = identity.emailAddresses
    .filter((address) => address.verification?.status === "verified")
    .map((address) => address.emailAddress.trim().toLowerCase());
  const primaryEmail = identity.primaryEmailAddress;
  const email =
    primaryEmail?.verification?.status === "verified"
      ? primaryEmail.emailAddress.trim().toLowerCase()
      : verifiedEmails[0];

  if (!email) {
    res.status(403).json({ error: "Your sign-in account has no email address." });
    return null;
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) {
    res.status(503).json({ error: "The initial administrator is not configured." });
    return null;
  }

  const [pendingAccount] = await db
    .select()
    .from(voiceStudioUsersTable)
    .where(eq(voiceStudioUsersTable.email, email))
    .limit(1);

  if (pendingAccount) {
    if (pendingAccount.clerkUserId && pendingAccount.clerkUserId !== userId) {
      res.status(403).json({ error: "This account is already linked." });
      return null;
    }
    const [activated] = await db
      .update(voiceStudioUsersTable)
      .set({
        clerkUserId: userId,
        status: "active",
        role: email === adminEmail ? "admin" : pendingAccount.role,
        displayName:
          pendingAccount.displayName ||
          getProfileName(identity.firstName, identity.lastName) ||
          email,
        invitationId: null,
      })
      .where(eq(voiceStudioUsersTable.id, pendingAccount.id))
      .returning();
    return activated ?? null;
  }

  if (!verifiedEmails.includes(adminEmail)) {
    res.status(403).json({
      error: "This account has not been invited to Voice Studio.",
    });
    return null;
  }

  const [adminAccount] = await db
    .insert(voiceStudioUsersTable)
    .values({
      clerkUserId: userId,
      email,
      displayName:
        getProfileName(identity.firstName, identity.lastName) || email,
      status: "active",
      role: "admin",
      tokenBalance: 0,
    })
    .onConflictDoNothing({ target: voiceStudioUsersTable.email })
    .returning();

  if (adminAccount) return adminAccount;

  const [racedAccount] = await db
    .select()
    .from(voiceStudioUsersTable)
    .where(eq(voiceStudioUsersTable.clerkUserId, userId))
    .limit(1);
  if (racedAccount) return racedAccount;

  res.status(409).json({ error: "Account setup is already in progress." });
  return null;
}

export function requireAdmin(
  account: VoiceStudioUser,
  res: Response,
): boolean {
  if (account.role === "admin") return true;
  res.status(403).json({ error: "Administrator access is required." });
  return false;
}

export function accountResponse(account: VoiceStudioUser) {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    role: account.role,
    tokenBalance: account.tokenBalance,
    createdAt: account.createdAt,
  };
}