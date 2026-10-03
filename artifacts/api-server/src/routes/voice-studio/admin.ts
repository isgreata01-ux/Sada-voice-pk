import { clerkClient, getAuth } from "@clerk/express";
import { and, count, desc, eq, ilike, or, sql, sum } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetAdminSummaryResponse,
  InviteAdminUserBody,
  InviteAdminUserResponse,
  ListAdminUsersQueryParams,
  ListAdminUsersResponse,
  RemoveAdminUserParams,
  SetAdminUserTokensBody,
  SetAdminUserTokensParams,
  SetAdminUserTokensResponse,
} from "@workspace/api-zod";
import {
  db,
  voiceStudioEventsTable,
  voiceStudioUsersTable,
} from "@workspace/db";
import { accountResponse, getSignedInAccount, requireAdmin } from "./auth";

const router: IRouter = Router();

router.get("/admin/summary", async (req, res): Promise<void> => {
  const account = await getSignedInAccount(req, res);
  if (!account || !requireAdmin(account, res)) return;

  const [totals] = await db
    .select({
      usersTotal: count(),
      activeUsers: sql<number>`count(*) filter (where ${voiceStudioUsersTable.status} = 'active')`,
      pendingInvites: sql<number>`count(*) filter (where ${voiceStudioUsersTable.status} = 'pending')`,
      totalTokens: sum(voiceStudioUsersTable.tokenBalance),
    })
    .from(voiceStudioUsersTable)
    .where(eq(voiceStudioUsersTable.role, "user"));

  const [generated] = await db
    .select({ total: count() })
    .from(voiceStudioEventsTable)
    .where(eq(voiceStudioEventsTable.eventType, "speech_generation"));

  const recentActivity = await db
    .select({
      id: voiceStudioEventsTable.id,
      description: voiceStudioEventsTable.description,
      createdAt: voiceStudioEventsTable.createdAt,
    })
    .from(voiceStudioEventsTable)
    .orderBy(desc(voiceStudioEventsTable.createdAt))
    .limit(8);

  res.json(
    GetAdminSummaryResponse.parse({
      usersTotal: Number(totals?.usersTotal ?? 0),
      activeUsers: Number(totals?.activeUsers ?? 0),
      pendingInvites: Number(totals?.pendingInvites ?? 0),
      totalTokens: Number(totals?.totalTokens ?? 0),
      generatedAudio: Number(generated?.total ?? 0),
      recentActivity,
    }),
  );
});

router.get("/admin/users", async (req, res): Promise<void> => {
  const account = await getSignedInAccount(req, res);
  if (!account || !requireAdmin(account, res)) return;

  const parsed = ListAdminUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const search = parsed.data.search?.trim();
  const users = await db
    .select({
      id: voiceStudioUsersTable.id,
      email: voiceStudioUsersTable.email,
      displayName: voiceStudioUsersTable.displayName,
      status: voiceStudioUsersTable.status,
      tokenBalance: voiceStudioUsersTable.tokenBalance,
      createdAt: voiceStudioUsersTable.createdAt,
    })
    .from(voiceStudioUsersTable)
    .where(
      and(
        eq(voiceStudioUsersTable.role, "user"),
        search
          ? or(
              ilike(voiceStudioUsersTable.email, `%${search}%`),
              ilike(voiceStudioUsersTable.displayName, `%${search}%`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(voiceStudioUsersTable.createdAt));

  res.json(ListAdminUsersResponse.parse(users));
});

router.post("/admin/users", async (req, res): Promise<void> => {
  const account = await getSignedInAccount(req, res);
  if (!account || !requireAdmin(account, res)) return;

  const parsed = InviteAdminUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (email === adminEmail) {
    res.status(400).json({ error: "The administrator account cannot be invited." });
    return;
  }

  const [managedAccount] = await db
    .insert(voiceStudioUsersTable)
    .values({
      email,
      displayName: parsed.data.displayName.trim(),
      status: "pending",
      role: "user",
      tokenBalance: parsed.data.initialTokens,
    })
    .onConflictDoNothing({ target: voiceStudioUsersTable.email })
    .returning();

  if (!managedAccount) {
    res.status(409).json({ error: "An account with that email already exists." });
    return;
  }

  let invitationId: string | null = null;
  try {
    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress: email,
    });
    invitationId = invitation.id;

    const [updatedAccount] = await db
      .update(voiceStudioUsersTable)
      .set({ invitationId })
      .where(eq(voiceStudioUsersTable.id, managedAccount.id))
      .returning();

    await db.insert(voiceStudioEventsTable).values({
      accountId: managedAccount.id,
      actorClerkUserId: getAuth(req).userId ?? null,
      eventType: "user_invited",
      description: `Invited ${email} with ${parsed.data.initialTokens.toLocaleString()} tokens`,
      tokenDelta: parsed.data.initialTokens,
    });

    res.status(201).json(
      InviteAdminUserResponse.parse({
        id: updatedAccount.id,
        email: updatedAccount.email,
        displayName: updatedAccount.displayName,
        status: updatedAccount.status,
        tokenBalance: updatedAccount.tokenBalance,
        createdAt: updatedAccount.createdAt,
      }),
    );
  } catch (error) {
    if (invitationId) {
      try {
        await clerkClient.invitations.revokeInvitation(invitationId);
      } catch {
        req.log.warn({ invitationId }, "Unable to revoke an incomplete invite");
      }
    }
    await db
      .delete(voiceStudioUsersTable)
      .where(eq(voiceStudioUsersTable.id, managedAccount.id));
    req.log.warn({ err: error }, "Unable to invite managed account");
    res.status(502).json({
      error: "The invitation could not be sent. Please try again.",
    });
  }
});

router.patch("/admin/users/:id/tokens", async (req, res): Promise<void> => {
  const account = await getSignedInAccount(req, res);
  if (!account || !requireAdmin(account, res)) return;

  const params = SetAdminUserTokensParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SetAdminUserTokensBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [target] = await db
    .select()
    .from(voiceStudioUsersTable)
    .where(
      and(
        eq(voiceStudioUsersTable.id, params.data.id),
        eq(voiceStudioUsersTable.role, "user"),
      ),
    )
    .limit(1);
  if (!target) {
    res.status(404).json({ error: "Managed account not found." });
    return;
  }

  const [updated] = await db.transaction(async (tx) => {
    const [user] = await tx
      .update(voiceStudioUsersTable)
      .set({ tokenBalance: parsed.data.balance })
      .where(eq(voiceStudioUsersTable.id, target.id))
      .returning();

    await tx.insert(voiceStudioEventsTable).values({
      accountId: target.id,
      actorClerkUserId: getAuth(req).userId ?? null,
      eventType: "tokens_adjusted",
      description: `Set ${target.email} to ${parsed.data.balance.toLocaleString()} tokens`,
      tokenDelta: parsed.data.balance - target.tokenBalance,
    });
    return [user];
  });

  res.json(
    SetAdminUserTokensResponse.parse({
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      status: updated.status,
      tokenBalance: updated.tokenBalance,
      createdAt: updated.createdAt,
    }),
  );
});

router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  const account = await getSignedInAccount(req, res);
  if (!account || !requireAdmin(account, res)) return;

  const params = RemoveAdminUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [target] = await db
    .select()
    .from(voiceStudioUsersTable)
    .where(
      and(
        eq(voiceStudioUsersTable.id, params.data.id),
        eq(voiceStudioUsersTable.role, "user"),
      ),
    )
    .limit(1);
  if (!target) {
    res.status(404).json({ error: "Managed account not found." });
    return;
  }
  if (target.clerkUserId === getAuth(req).userId) {
    res.status(409).json({ error: "You cannot remove your own admin account." });
    return;
  }

  try {
    if (target.status === "pending" && target.invitationId) {
      await clerkClient.invitations.revokeInvitation(target.invitationId);
    } else if (target.clerkUserId) {
      await clerkClient.users.deleteUser(target.clerkUserId);
    }
  } catch (error) {
    req.log.warn({ err: error }, "Unable to remove the Clerk account");
    res.status(502).json({
      error: "The account could not be removed from sign-in. Please try again.",
    });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.insert(voiceStudioEventsTable).values({
      accountId: null,
      actorClerkUserId: getAuth(req).userId ?? null,
      eventType: "user_removed",
      description: `Removed ${target.email}`,
    });
    await tx
      .delete(voiceStudioUsersTable)
      .where(eq(voiceStudioUsersTable.id, target.id));
  });

  res.sendStatus(204);
});

export default router;