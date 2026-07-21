import type { Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { AppError, toTrpcError } from "../../core/errors";
import type { CalendarContext } from "../../trpc/context";
import { protectedProcedure, router } from "../../trpc/trpc";
import { isBackingOff } from "./backoff";
import { ensureWriteCalendar } from "./calendar-setup";
import { listChannelsForUid } from "./channel-registry";
import { registerCalendarChannels, stopCalendarChannels } from "./channel-setup";
import { clearMirror } from "./gcal-mirror";
import type { GCalendarInfo } from "./google-client";
import { retireCalendarMirrors } from "./lived-engine";
import { SCOPE_VERSION } from "./oauth";
import { type ReconcileDeps, runReconcile } from "./reconcile";
import { SyncLockBusyError } from "./sync-lock";
import { isValidTimeZone } from "./time-zone";
import {
  type CalendarPref,
  clearGcalAccount,
  type GcalAccount,
  isBenignSyncFault,
  readGcalAccount,
  removeCalendarPrefs,
  removeSyncTokens,
  storeConnection,
  writeGcalAccount,
} from "./token-store";

const MAX_READ_CALENDARS = 10;

const reconcileDepsFrom = (ctx: {
  firestore: Firestore;
  calendar: CalendarContext;
}): ReconcileDeps => ({
  firestore: ctx.firestore,
  getClient: ctx.calendar.getClient,
  now: ctx.calendar.now,
  webhookUrl: ctx.calendar.webhookUrl,
});

function buildReadCalendarUpdate(
  account: GcalAccount,
  ids: string[],
  infoById: Map<string, GCalendarInfo>,
): { added: string[]; removed: string[]; calendarPrefs: Record<string, CalendarPref> } {
  const prior = account.readCalendarIds ?? [];
  const added = ids.filter((id) => !prior.includes(id));
  const removed = prior.filter((id) => !ids.includes(id));
  const calendarPrefs = { ...(account.calendarPrefs ?? {}) };
  for (const id of added) {
    const info = infoById.get(id);
    calendarPrefs[id] = {
      visible: true,
      summary: info?.summary ?? id,
      color: info?.backgroundColor ?? null,
    };
  }
  return { added, removed, calendarPrefs };
}

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
        timeZone: isValidTimeZone(input.timeZone) ? input.timeZone : "UTC",
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

  listCalendars: protectedProcedure.query(async ({ ctx }) => {
    const account = await readGcalAccount(ctx.firestore, ctx.uid);
    const client = await ctx.calendar.getClient(ctx.uid);
    const calendars = await client.listCalendars();
    return calendars.filter(
      (calendar) => calendar.id !== account?.writeCalendarId && calendar.summary !== "VEGA",
    );
  }),

  setReadCalendars: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }).strict())
    .mutation(async ({ ctx, input }) => {
      if (input.ids.length > MAX_READ_CALENDARS) {
        throw toTrpcError(
          new AppError("BAD_REQUEST", `at most ${MAX_READ_CALENDARS} calendars can sync`),
        );
      }
      const account = await readGcalAccount(ctx.firestore, ctx.uid);
      if (!account) throw toTrpcError(new AppError("BAD_REQUEST", "calendar not connected"));

      const client = await ctx.calendar.getClient(ctx.uid);
      const infoById = new Map((await client.listCalendars()).map((info) => [info.id, info]));
      const { added, removed, calendarPrefs } = buildReadCalendarUpdate(
        account,
        input.ids,
        infoById,
      );
      await writeGcalAccount(ctx.firestore, ctx.uid, {
        readCalendarIds: input.ids,
        calendarPrefs,
      });
      await removeSyncTokens(ctx.firestore, ctx.uid, removed);
      await removeCalendarPrefs(ctx.firestore, ctx.uid, removed);

      const deps = reconcileDepsFrom(ctx);
      await registerCalendarChannels(deps, ctx.uid, client, added);
      await stopCalendarChannels(ctx.firestore, ctx.uid, client, removed);
      const now = ctx.calendar.now();
      for (const id of removed) {
        await retireCalendarMirrors(deps, ctx.uid, id, now);
      }
      await runReconcile(deps, ctx.uid).catch((error) => {
        if (!isBenignSyncFault(error)) throw error;
      });
      return { readCalendarIds: input.ids };
    }),

  setCalendarVisibility: protectedProcedure
    .input(z.object({ calendarId: z.string(), visible: z.boolean() }).strict())
    .mutation(async ({ ctx, input }) => {
      const account = await readGcalAccount(ctx.firestore, ctx.uid);
      const prior = account?.calendarPrefs?.[input.calendarId];
      await writeGcalAccount(ctx.firestore, ctx.uid, {
        calendarPrefs: {
          ...(account?.calendarPrefs ?? {}),
          [input.calendarId]: {
            visible: input.visible,
            summary: prior?.summary ?? input.calendarId,
            color: prior?.color ?? null,
          },
        },
      });
      return { ok: true as const };
    }),

  setTimeZone: protectedProcedure
    .input(z.object({ timeZone: z.string() }).strict())
    .mutation(async ({ ctx, input }) => {
      if (!isValidTimeZone(input.timeZone))
        throw toTrpcError(new AppError("BAD_REQUEST", "invalid timezone"));
      await writeGcalAccount(ctx.firestore, ctx.uid, { timeZone: input.timeZone });
      return { ok: true as const };
    }),

  syncNow: protectedProcedure.mutation(async ({ ctx }) => {
    const account = await readGcalAccount(ctx.firestore, ctx.uid);
    if (!account || account.needsReauth) return { synced: false, reason: "needs_reauth" as const };
    if (account.writeCalendarMissing)
      return { synced: false, reason: "write_calendar_missing" as const };
    if (isBackingOff(account.backoff, ctx.calendar.now()))
      return { synced: false, reason: "backing_off" as const };
    try {
      await runReconcile(reconcileDepsFrom(ctx), ctx.uid);
      return { synced: true };
    } catch (error) {
      if (error instanceof SyncLockBusyError) return { synced: false, reason: "locked" as const };
      if (isBenignSyncFault(error)) return { synced: false, reason: "backing_off" as const };
      throw error;
    }
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
