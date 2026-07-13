import type { Task } from "@vega/shared";
import { createRepository, type WritableEntity } from "../core/repository";
import { storeConnection, writeGcalAccount } from "../features/calendar/token-store";
import type { TestServer } from "./harness";
import { sampleByCollection } from "./samples";

export type ConnectOptions = { writeCalendarId: string; readCalendarIds?: string[] };

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
