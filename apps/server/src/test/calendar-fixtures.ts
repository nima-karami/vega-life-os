import type { Task } from "@vega/shared";
import { addDays, format } from "date-fns";
import { createRepository, type WritableEntity } from "../core/repository";
import { storeConnection, writeGcalAccount } from "../features/calendar/token-store";
import type { TestServer } from "./harness";
import { sampleByCollection } from "./samples";

export type ConnectOptions = { writeCalendarId: string; readCalendarIds?: string[] };

/** Sync only pushes dates inside a window around today, so a fixture date must track the clock. */
export const isoDaysFromToday = (offset: number): string =>
  format(addDays(new Date(), offset), "yyyy-MM-dd");

export async function connectCalendar(
  server: TestServer,
  uid: string,
  options: ConnectOptions,
): Promise<void> {
  await storeConnection(
    server.firestore,
    uid,
    `refresh-${uid}`,
    server.config.oauth.tokenEncryptionKey,
    {
      connectedAt: server.now(),
      scopeVersion: 1,
    },
  );
  await writeGcalAccount(server.firestore, uid, {
    writeCalendarId: options.writeCalendarId,
    readCalendarIds: options.readCalendarIds ?? [],
    syncTokens: {},
  });
}

export function taskInput(
  id: string,
  over: Partial<WritableEntity<"tasks">> = {},
): WritableEntity<"tasks"> {
  return { ...sampleByCollection.tasks(id), ...over };
}

export function storedTask(over: Partial<Task> = {}): Task {
  return {
    ...sampleByCollection.tasks(over.id ?? "t1"),
    updatedAt: "2026-07-13T10:00:00.000Z",
    fieldUpdatedAt: {},
    ...over,
  };
}

export function upsertTask(
  server: TestServer,
  uid: string,
  id: string,
  over: Partial<WritableEntity<"tasks">> = {},
): Promise<Task> {
  return createRepository(server.firestore, uid, "tasks").upsert(taskInput(id, over));
}
