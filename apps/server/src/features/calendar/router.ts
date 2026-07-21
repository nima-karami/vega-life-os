import type { Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { AppError, toTrpcError } from "../../core/errors";
import type { CalendarContext } from "../../trpc/context";
import { protectedProcedure, router } from "../../trpc/trpc";
import { ensureWriteCalendar } from "./calendar-setup";
import { listChannelsForUid } from "./channel-registry";
import { registerCalendarChannels, stopCalendarChannels } from "./channel-setup";
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
    .input(z.object({ code: z.string(), timeZone: z.string() }).strict())
    .mutation(async ({ ctx, input }) => {
      const tokens = await ctx.calendar.gateway.exchangeCode(input.code);
      if (!tokens.refreshToken) {
        throw toTrpcError(new AppError("BAD_REQUEST", "GCAL_NO_REFRESH_TOKEN"));
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

      const account = await readGcalAccount(ctx.firestore, ctx.uid);
      let readCalendarIds = account?.readCalendarIds ?? [];
      let calendarPrefs = account?.calendarPrefs ?? {};
      if (readCalendarIds.length === 0) {
        const primary = (await client.listCalendars()).find((calendar) => calendar.primary);
        if (primary) {
          readCalendarIds = [primary.id];
          calendarPrefs = {
            [primary.id]: {
              visible: true,
              summary: primary.summary,
              color: primary.backgroundColor,
            },
          };
        }
      }
      await writeGcalAccount(ctx.firestore, ctx.uid, {
        timeZone: input.timeZone,
        readCalendarIds,
        calendarPrefs,
        writeCalendarMissing: false,
        backoff: null,
      });

      const deps = reconcileDepsFrom(ctx);
      await registerCalendarChannels(deps, ctx.uid, client, [writeCalendarId, ...readCalendarIds]);
      await runReconcile(deps, ctx.uid).catch((error) => {
        if (!isBenignSyncFault(error)) throw error;
      });
      return { connected: true, writeCalendarId };
    }),

  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const channels = await listChannelsForUid(ctx.firestore, ctx.uid);
    const client = await ctx.calendar.getClient(ctx.uid).catch(() => null);
    await stopCalendarChannels(
      ctx.firestore,
      ctx.uid,
      client,
      channels.map((channel) => channel.calendarId),
    );
    await clearGcalAccount(ctx.firestore, ctx.uid);
    return { connected: false };
  }),
});
