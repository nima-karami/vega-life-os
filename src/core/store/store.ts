import { create } from "zustand";
import { auth, db } from "@/core/firebase/app";
import { getCloudProfile } from "@/core/firebase/profile";
import type { CollectionName, CollectionSnapshot, Dataset } from "@/core/persistence";
import {
  buildSeed,
  COLLECTIONS,
  DexieAdapter,
  emptyDataset,
  persistence,
  type RoutingAdapter,
} from "@/core/persistence";
import { FirestoreAdapter } from "@/core/persistence/firestore-adapter";
import { getSandboxDirty, isSandboxDirty, setSandboxDirty } from "@/core/persistence/sandbox-meta";
import { createGoalsSlice } from "@/features/goals/store";
import { normalizeHabit } from "@/features/habits/recurrence";
import { createHabitsSlice } from "@/features/habits/store";
import { createJournalSlice } from "@/features/journal/store";
import { createLibrarySlice } from "@/features/library/store";
import { createReviewSlice } from "@/features/review/store";
import { createTasksSlice } from "@/features/tasks/store";
import { createValuesSlice } from "@/features/values/store";
import { authTransition } from "./auth-transition";
import { setPersistAuth } from "./persist";
import { resolveProfile } from "./profile";
import type { RootState } from "./types";
import { createUiSlice } from "./ui";

let unsubscribeRemote: (() => void) | null = null;

async function loadAccount(
  uid: string,
  set: (p: Partial<RootState>) => void,
  get: () => RootState,
) {
  unsubscribeRemote?.();
  unsubscribeRemote = null;
  if (!db) {
    set({ loadFailed: true, ready: true });
    return;
  }
  const routing = persistence as RoutingAdapter;
  const cloud = new FirestoreAdapter(db, uid);
  routing.setDelegate(cloud);
  await get().clearLocal(); // abandon the local sandbox — never uploaded
  try {
    const data = await cloud.loadAll();
    set({ ...(sorted(data) as Partial<RootState>), loadFailed: false, ready: true });
    const profile = await getCloudProfile(uid).catch(() => null);
    get().hydrateProfile(resolveProfile(profile, auth?.currentUser ?? null));
    get().ensureUpcoming(14);
    unsubscribeRemote = cloud.subscribe((snap) => get().applyRemote(snap));
  } catch {
    set({ loadFailed: true, ready: true });
  }
}

/** Apply the same per-collection ordering bootstrap() uses. */
function sorted(data: Partial<Dataset>): Partial<Dataset> {
  const out: Partial<Dataset> = { ...data };
  // Normalize archivedAt on read: records created before archiving lack the field
  // (undefined); coerce to null so they classify as active, not archived.
  if (data.values)
    out.values = data.values
      .map((v) => ({ ...v, archivedAt: v.archivedAt ?? null }))
      .sort((a, b) => a.order - b.order);
  if (data.habits)
    out.habits = data.habits.map((h) => normalizeHabit({ ...h, archivedAt: h.archivedAt ?? null }));
  if (data.goals)
    out.goals = data.goals
      .map((g) => ({ ...g, status: g.status ?? "active" }))
      .sort((a, b) => a.order - b.order);
  if (data.books) out.books = [...data.books].sort((a, b) => a.order - b.order);
  if (data.movies) out.movies = [...data.movies].sort((a, b) => a.order - b.order);
  if (data.reviews)
    out.reviews = [...data.reviews].sort((a, b) => (a.periodKey < b.periodKey ? 1 : -1));
  if (data.journal) out.journal = [...data.journal].sort((a, b) => (a.date < b.date ? 1 : -1));
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
  ...createUiSlice(set, get, api),

  ready: false,
  authUid: null,
  authResolved: false,
  pendingSignIn: null,
  loadFailed: false,

  bootstrap: async () => {
    await persistence.init();
    const data = await persistence.loadAll();
    set({
      values: data.values
        .map((v) => ({ ...v, archivedAt: v.archivedAt ?? null }))
        .sort((a, b) => a.order - b.order),
      goals: data.goals
        .map((g) => ({ ...g, status: g.status ?? "active" }))
        .sort((a, b) => a.order - b.order),
      habits: data.habits.map((h) => ({ ...h, archivedAt: h.archivedAt ?? null })),
      tasks: data.tasks,
      books: data.books.sort((a, b) => a.order - b.order),
      movies: data.movies.sort((a, b) => a.order - b.order),
      vocab: data.vocab,
      reviews: data.reviews.sort((a, b) => (a.periodKey < b.periodKey ? 1 : -1)),
      journal: data.journal.sort((a, b) => (a.date < b.date ? 1 : -1)),
      ready: true,
    });
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
    set({ ...emptyDataset() });
  },

  confirmPendingSignIn: async () => {
    const uid = get().pendingSignIn;
    if (!uid) return;
    setPersistAuth(uid);
    set({ authUid: uid, pendingSignIn: null });
    await loadAccount(uid, set, get);
  },

  exportJSON: () => {
    const s = get();
    const data: Dataset = {
      ...emptyDataset(),
      values: s.values,
      goals: s.goals,
      habits: s.habits,
      tasks: s.tasks,
      books: s.books,
      movies: s.movies,
      vocab: s.vocab,
      reviews: s.reviews,
      journal: s.journal,
    };
    return JSON.stringify(
      { app: "vega-life-os", version: 1, exportedAt: new Date().toISOString(), data },
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
    const data = parsed?.data;
    if (!data || typeof data !== "object") return false;
    await persistence.clearAll();
    const next: Partial<Dataset> = {};
    for (const col of COLLECTIONS) {
      const arr = (data as Record<CollectionName, unknown>)[col];
      if (Array.isArray(arr)) {
        await persistence.bulkPut(col, arr as never);
        (next as Record<string, unknown>)[col] = arr;
      }
    }
    set(next as Partial<RootState>);
    return true;
  },

  applyRemote: (snap: CollectionSnapshot) => {
    set(sorted({ [snap.col]: snap.items }) as Partial<RootState>);
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
      unsubscribeRemote?.();
      unsubscribeRemote = null;
      routing.setDelegate(new DexieAdapter());
      await get().clearLocal();
      void setSandboxDirty(false);
      get().setOnboarded(false);
      get().hydrateProfile({
        name: "Operator",
        email: "",
        avatar: "",
        workspace: "Personal workspace",
      });
      set({ ...emptyDataset(), pendingSignIn: null, loadFailed: false, ready: true });
    }
  },
}));
