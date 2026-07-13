import type { CalendarContext } from "../trpc/context";

/** A calendar context for tests that never exercise a calendar procedure (auth/context specs). */
export const stubCalendar: CalendarContext = {
  gateway: {
    buildConsentUrl: () => "",
    exchangeCode: async () => {
      throw new Error("stub gateway");
    },
    refresh: async () => {
      throw new Error("stub gateway");
    },
  },
  getClient: async () => {
    throw new Error("stub client");
  },
  now: () => new Date().toISOString(),
  webhookUrl: "https://stub.example/webhooks/gcal",
};
