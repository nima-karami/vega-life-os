import type { Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { AppError, toTrpcError } from "../../core/errors";
import type { CalendarContext } from "../../trpc/context";
import { protectedProcedure, router } from "../../trpc/trpc";
import { ensureWriteCalendar } from "./calendar-setup";
import { listChannelsForUid, removeChannel } from "./channel-registry";
import { clearMirror } from "./gcal-mirror";
import { SCOPE_VERSION } from "./oauth";
import { type ReconcileDeps, runReconcile } from "./reconcile";
import {
  clearGcalAccount,
  isBenignSyncFault,
  readGcalAccount,
  storeConnection,
  writeGcalAccount,
} from "./token-store";

const reconcileDepsFrom = (ctx: {
  firestore: Firestore;
  calendar: CalendarContext;
}): ReconcileDeps => ({
  firestore: ctx.firestore,
  getClient: ctx.calendar.getClient,
  now: ctx.calendar.now,
  webhookUrl: ctx.calendar.webhookUrl,
});

export const calendarRouter = router({
  connect: protectedProcedure.query(({ ctx }) => ({
    consentUrl: ctx.calendar.gateway.buildConsentUrl(ctx.uid),
  })),

  status: protectedProcedure.query(async ({ ctx }) => {
    const account = await readGcalAccount(ctx.firestore, ctx.uid);
    const needsReauth =
      (account?.needsReauth ?? false) || (account ? account.scopeVersion < SCOPE_VERSION : false);
    return {
      connected: Boolean(account?.refreshTokenCipher) && !needsReauth,
      needsReauth,
      writeCalendarMissing: account?.writeCalendarMissing ?? false,
      writeCalendarId: account?.writeCalendarId ?? null,
      readCalendarIds: account?.readCalendarIds ?? [],
      calendarPrefs: account?.calendarPrefs ?? {},
      timeZone: account?.timeZone ?? null,
      lastSyncedAt: account?.lastSyncedAt ?? null,
      backoffUntil: account?.backoff?.nextAllowedAt ?? null,
    };
  }),

  recreateWriteCalendar: protectedProcedure.mutation(async ({ ctx }) => {
    const account = await readGcalAccount(ctx.firestore, ctx.uid);
    if (!account?.writeCalendarMissing)
      throw toTrpcError(new AppError("BAD_REQUEST", "write calendar is not missing"));
    const staleId = account.writeCalendarId;
    const syncTokens = { ...(account.syncTokens ?? {}) };
    if (staleId) delete syncTokens[staleId];
    await writeGcalAccount(ctx.firestore, ctx.uid, {
      writeCalendarId: null,
      writeCalendarMissing: false,
      syncTokens,
    });
    await clearMirror(ctx.firestore, ctx.uid);
    const client = await ctx.calendar.getClient(ctx.uid);
    const writeCalendarId = await ensureWriteCalendar(ctx.firestore, ctx.uid, client);
    await runReconcile(reconcileDepsFrom(ctx), ctx.uid).catch((error) => {
      if (!isBenignSyncFault(error)) throw error;
    });
    return { writeCalendarId };
  }),

  oauthCallback: protectedProcedure
    .input(z.object({ code: z.string() }).strict())
    .mutation(async ({ ctx, input }) => {
      const tokens = await ctx.calendar.gateway.exchangeCode(input.code);
      if (!tokens.refreshToken) {
        throw toTrpcError(new AppError("BAD_REQUEST", "google returned no refresh token"));
      }
      await storeConnection(
        ctx.firestore,
        ctx.uid,
        tokens.refreshToken,
        ctx.config.oauth.tokenEncryptionKey,
        { connectedAt: ctx.calendar.now(), scopeVersion: SCOPE_VERSION },
      );
      const client = await ctx.calendar.getClient(ctx.uid);
      const writeCalendarId = await ensureWriteCalendar(ctx.firestore, ctx.uid, client);
      return { connected: true, writeCalendarId };
    }),

  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const channels = await listChannelsForUid(ctx.firestore, ctx.uid);
    for (const channel of channels) {
      const client = await ctx.calendar.getClient(ctx.uid).catch(() => null);
      await client?.stopChannel(channel.channelId, channel.resourceId).catch(() => undefined);
      await removeChannel(ctx.firestore, channel.channelId);
    }
    await clearGcalAccount(ctx.firestore, ctx.uid);
    return { connected: false };
  }),
});
