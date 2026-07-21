import { create } from "zustand";
import { auth, db } from "@/core/firebase/app";
import { getCloudProfile } from "@/core/firebase/profile";
import type { CollectionName, Dataset } from "@/core/persistence";
import {
  buildSeed,
  COLLECTIONS,
  createEmptyDataset,
  DexieAdapter,
  persistence,
  type RoutingAdapter,
} from "@/core/persistence";
import { runDataMigrations } from "@/core/persistence/migrations";
import { getSandboxDirty, isSandboxDirty, setSandboxDirty } from "@/core/persistence/sandbox-meta";
import { TrpcAdapter } from "@/core/persistence/trpc-adapter";
import { loadShowGoogleEvents } from "@/features/calendar-sync/config";
import { createCalendarEventsSlice } from "@/features/calendar-sync/store";
import { createGoalsSlice } from "@/features/goals/store";
import { normalizeHabit } from "@/features/habits/recurrence";
import { createHabitsSlice } from "@/features/habits/store";
import { createJournalSlice } from "@/features/journal/store";
import { createLibrarySlice } from "@/features/library/store";
import { createReviewSlice } from "@/features/review/store";
import { loadStreakRules, readLocalStreakRules } from "@/features/streaks/config";
import { createStreaksSlice } from "@/features/streaks/store";
import { createTasksSlice } from "@/features/tasks/store";
import { createValuesSlice } from "@/features/values/store";
import { authTransition } from "./auth-transition";
import { bindPersistStore, pendingWriteCollections, setPersistAuth } from "./persist";
import { resolveProfile } from "./profile";
import type { RootState } from "./types";
import { createUiSlice } from "./ui";

async function loadAccount(
  uid: string,
  set: (p: Partial<RootState>) => void,
  get: () => RootState,
) {
  if (!db) {
    set({ loadFailed: true, ready: true });
    return;
  }
  const routing = persistence as RoutingAdapter;
  // Online-first: the signed-in write path is the backend (apps/server), never
  // client-direct Firestore. Realtime is off — the store refetches on focus/interval.
  const cloud = new TrpcAdapter();
  routing.setDelegate(cloud);
  // Hold the boot spinner until the profile is hydrated, so the onboarding
  // "what should we call you?" step doesn't flash before the name arrives.
  set({ ready: false });
  await get().clearLocal(); // abandon the local sandbox — never uploaded
  try {
    const loaded = await cloud.loadAll(); // hydrating → hydrated
    set({ ...(sortDataset(loaded) as Partial<RootState>), loadFailed: false });
    runDataMigrations(get, set);
    const profile = await getCloudProfile(uid).catch(() => null);
    get().hydrateProfile(resolveProfile(profile, auth?.currentUser ?? null));
    set({ ready: true }); // name known — safe to render the app / ProfileStep
    await get().refreshGcalStatus(); // server-owned GCal connection status
    get().hydrateShowGoogleEvents(await loadShowGoogleEvents(uid)); // display pref (profile)
    get().hydrateStreakRules(await loadStreakRules(uid)); // user-level streak rules (cloud)
    get().ensureUpcoming(14);
  } catch {
    set({ loadFailed: true, ready: true }); // hydrate-failed → full-screen retry
  }
}

/** Per-collection ordering + read-normalization applied on every load (boot, account hydrate, refetch). */
function sortDataset(dataset: Partial<Dataset>): Partial<Dataset> {
  const out: Partial<Dataset> = { ...dataset };
  // Normalize archivedAt on read: records created before archiving lack the field
  // (undefined); coerce to null so they classify as active, not archived.
  if (dataset.values)
    out.values = dataset.values
      .map((v) => ({ ...v, archivedAt: v.archivedAt ?? null }))
      .sort((a, b) => a.order - b.order);
  if (dataset.habits)
    out.habits = dataset.habits.map((h) =>
      normalizeHabit({ ...h, archivedAt: h.archivedAt ?? null }),
    );
  if (dataset.goals)
    out.goals = dataset.goals
      .map((g) => ({ ...g, status: g.status ?? "active" }))
      .sort((a, b) => a.order - b.order);
  if (dataset.books) out.books = [...dataset.books].sort((a, b) => a.order - b.order);
  if (dataset.movies) out.movies = [...dataset.movies].sort((a, b) => a.order - b.order);
  if (dataset.reviews)
    out.reviews = [...dataset.reviews].sort((a, b) => (a.periodKey < b.periodKey ? 1 : -1));
  if (dataset.journal)
    out.journal = [...dataset.journal].sort((a, b) => (a.date < b.date ? 1 : -1));
  return out;
}

export const useStore = create<RootState>((set, get, api) => ({
  ...createValuesSlice(set, get, api),
  ...createGoalsSlice(set, get, api),
  ...createHabitsSlice(set, get, api),
  ...createTasksSlice(set, get, api),
  ...createLibrarySlice(set, get, api),
  ...createReviewSlice(set, get, api),
  ...createJournalSlice(set, get, api),
  ...createCalendarEventsSlice(set, get, api),
  ...createStreaksSlice(set, get, api),
  ...createUiSlice(set, get, api),

  ready: false,
  authUid: null,
  authResolved: false,
  pendingSignIn: null,
  loadFailed: false,

  bootstrap: async () => {
    await persistence.init();
    const loaded = await persistence.loadAll();
    set({ ...(sortDataset(loaded) as Partial<RootState>), ready: true });
    get().hydrateGcalStatus(null); // signed-out sandbox: no Google Calendar connection
    get().hydrateStreakRules(readLocalStreakRules());
    runDataMigrations(get, set);
    get().ensureUpcoming(14);
  },

  seedDemo: async () => {
    if (get().authUid) return;
    if (await persistence.isEmpty()) {
      const seed = buildSeed();
      await Promise.all(COLLECTIONS.map((col) => persistence.bulkPut(col, seed[col] as never)));
      void setSandboxDirty(false);
    }
    await get().bootstrap();
  },

  clearLocal: async () => {
    await new DexieAdapter().clearAll();
  },

  resetDemo: async () => {
    if (get().authUid) return; // never touch a real account
    await new DexieAdapter().clearAll();
    const seed = buildSeed();
    await Promise.all(COLLECTIONS.map((col) => persistence.bulkPut(col, seed[col] as never)));
    set({
      values: seed.values,
      goals: seed.goals,
      habits: seed.habits,
      tasks: seed.tasks,
      books: seed.books,
      movies: seed.movies,
      vocab: seed.vocab,
      reviews: seed.reviews,
      journal: seed.journal,
    });
    void setSandboxDirty(false);
  },

  deleteAllData: async () => {
    await persistence.clearAll();
    set({ ...createEmptyDataset() });
  },

  confirmPendingSignIn: async () => {
    const uid = get().pendingSignIn;
    if (!uid) return;
    setPersistAuth(uid);
    set({ authUid: uid, pendingSignIn: null });
    await loadAccount(uid, set, get);
  },

  exportJSON: () => {
    const state = get();
    const dataset: Dataset = {
      ...createEmptyDataset(),
      values: state.values,
      goals: state.goals,
      habits: state.habits,
      tasks: state.tasks,
      books: state.books,
      movies: state.movies,
      vocab: state.vocab,
      reviews: state.reviews,
      journal: state.journal,
    };
    return JSON.stringify(
      { app: "vega-life-os", version: 1, exportedAt: new Date().toISOString(), data: dataset },
      null,
      2,
    );
  },

  importJSON: async (text) => {
    let parsed: { data?: Partial<Dataset> };
    try {
      parsed = JSON.parse(text);
    } catch {
      return false;
    }
    const payload = parsed?.data;
    if (!payload || typeof payload !== "object") return false;
    await persistence.clearAll();
    const next: Partial<Dataset> = {};
    for (const col of COLLECTIONS) {
      const rows = (payload as Record<CollectionName, unknown>)[col];
      if (Array.isArray(rows)) {
        await persistence.bulkPut(col, rows as never);
        (next as Record<string, unknown>)[col] = rows;
      }
    }
    set(next as Partial<RootState>);
    return true;
  },

  // Realtime is off — signed-in clients pull server truth on focus + interval, and
  // after a rejected write to reconcile the reverted collection. Best-effort; a
  // failed refetch leaves the current store untouched.
  refetchAll: async () => {
    if (!get().authUid) return;
    const guarded = pendingWriteCollections();
    try {
      const loaded = await persistence.loadAll();
      for (const col of pendingWriteCollections()) guarded.add(col);
      const next = sortDataset(loaded);
      for (const col of guarded) delete next[col];
      set(next as Partial<RootState>);
    } catch {
      /* keep current state; next focus/interval retries */
    }
  },

  refetchCollection: async (col) => {
    if (!get().authUid || pendingWriteCollections().has(col)) return;
    try {
      const rows = await persistence.load(col);
      set(sortDataset({ [col]: rows }) as Partial<RootState>);
    } catch {
      /* best-effort reconcile */
    }
  },

  onAuthChange: async (uid: string | null) => {
    const routing = persistence as RoutingAdapter;
    const t = authTransition(get().authUid, uid, get().authResolved);

    // Dirty-sandbox sign-in: park WITHOUT committing auth state or switching the
    // delegate, so cancelling (which signs back out → onAuthChange(null)) classifies
    // as a noop and leaves the sandbox fully intact. Auth is committed only in
    // confirmPendingSignIn once the user chooses to continue.
    if (t === "sign-in" && uid) {
      const hasRows = !(await new DexieAdapter().isEmpty());
      if (isSandboxDirty(await getSandboxDirty(), hasRows)) {
        set({ authResolved: true, pendingSignIn: uid });
        return;
      }
    }

    setPersistAuth(uid);
    set({ authUid: uid, authResolved: true });

    if (t === "noop") return;

    if (t === "initial-sandbox") {
      routing.setDelegate(new DexieAdapter());
      await get().bootstrap();
      return;
    }
    if (t === "initial-account" || t === "switch-account") {
      if (uid) await loadAccount(uid, set, get);
      return;
    }
    if (t === "sign-in" && uid) {
      // clean (non-dirty) sign-in — the gate above already handled the dirty case
      await loadAccount(uid, set, get);
      return;
    }
    if (t === "sign-out") {
      routing.setDelegate(new DexieAdapter());
      await get().clearLocal();
      void setSandboxDirty(false);
      get().hydrateGcalStatus(null); // clear the account's Google Calendar status
      get().hydrateShowGoogleEvents(true); // back to the default display pref
      get().hydrateStreakRules(readLocalStreakRules()); // back to the device-local sandbox rules
      get().setOnboarded(false);
      get().hydrateProfile({
        name: "Operator",
        email: "",
        avatar: "",
        workspace: "Personal workspace",
      });
      set({ ...createEmptyDataset(), pendingSignIn: null, loadFailed: false, ready: true });
    }
  },
}));

bindPersistStore(useStore);
