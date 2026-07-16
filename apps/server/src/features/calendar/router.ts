import { z } from "zod";
import { AppError, toTrpcError } from "../../core/errors";
import { protectedProcedure, router } from "../../trpc/trpc";
import { ensureWriteCalendar } from "./calendar-setup";
import { listChannelsForUid, removeChannel } from "./channel-registry";
import { SCOPE_VERSION } from "./oauth";
import { clearGcalAccount, readGcalAccount, storeConnection } from "./token-store";

export const calendarRouter = router({
  connect: protectedProcedure.query(({ ctx }) => ({
    consentUrl: ctx.calendar.gateway.buildConsentUrl(ctx.uid),
  })),

  status: protectedProcedure.query(async ({ ctx }) => {
    const account = await readGcalAccount(ctx.firestore, ctx.uid);
    return {
      connected: Boolean(account?.refreshTokenCipher) && !account?.needsReauth,
      needsReauth: account?.needsReauth ?? false,
      writeCalendarId: account?.writeCalendarId ?? null,
    };
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
