import { createSyncCursor, DEFAULT_CARD_PREFS } from "@vega/shared";
import { create } from "zustand";
import { auth, db } from "@/core/firebase/app";
import { getCloudProfile } from "@/core/firebase/profile";
import type { CollectionName, Dataset, LoadedDataset } from "@/core/persistence";
import {
  buildSeed,
  COLLECTIONS,
  createEmptyDataset,
  DexieAdapter,
  persistence,
  type RoutingAdapter,
} from "@/core/persistence";
import { clearLegacyStreakRules } from "@/core/persistence/legacy-keys";
import { hasMigrationSources, runDataMigrations } from "@/core/persistence/migrations";
import { getSandboxDirty, isSandboxDirty, setSandboxDirty } from "@/core/persistence/sandbox-meta";
import { TrpcAdapter } from "@/core/persistence/trpc-adapter";
import { loadShowGoogleEvents } from "@/features/calendar-sync/config";
import { createCalendarEventsSlice } from "@/features/calendar-sync/store";
import { createCardsBulkSlice } from "@/features/cards/bulk-store";
import { createCardsSlice, resolveCardPrefs } from "@/features/cards/store";
import { createFinanceSlice } from "@/features/finance/store";
import { createGoalsSlice } from "@/features/goals/store";
import { normalizeHabit } from "@/features/habits/recurrence";
import { createHabitsSlice } from "@/features/habits/store";
import { readLocalGratitudeNudgeAck } from "@/features/journal/nudge-ack";
import { createJournalSlice } from "@/features/journal/store";
import { createLibrarySlice } from "@/features/library/store";
import { normalizeReview } from "@/features/review/model";
import { createReviewSlice } from "@/features/review/store";
import { createTasksSlice } from "@/features/tasks/store";
import { createValuesSlice } from "@/features/values/store";
import { type AuthTransition, authTransition } from "./auth-transition";
import { mergeRecord, mergeRows } from "./merge-rows";
import { bindPersistStore, pendingWriteCollections, setPersistAuth } from "./persist";
import { resolveProfile } from "./profile";
import { readLocalQuietMode } from "./quiet-mode";
import type { RootState } from "./types";
import { createUiSlice } from "./ui";

/** Replaced per account load, so a write still in flight for the previous account reports to a dead cursor. */
let syncCursor = createSyncCursor();

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
  const cursor = createSyncCursor();
  syncCursor = cursor;
  const cloud = new TrpcAdapter(undefined, (version) => cursor.recordOwnWrite(version));
  routing.setDelegate(cloud);
  // Hold the boot spinner until the profile is hydrated, so the onboarding
  // "what should we call you?" step doesn't flash before the name arrives.
  set({ ready: false });
  await get().clearLocal(); // abandon the local sandbox — never uploaded
  try {
    // Read the counter first: recording a version taken *after* the load would swallow a write
    // that landed mid-load, leaving the client silently stale.
    cursor.reset(await cloud.readSyncVersion().catch(() => null));
    const loaded = withEmptyStamps(await cloud.loadAll()); // hydrating → hydrated
    set({ ...toStatePatch(loaded), loadFailed: false });
    await runDataMigrations(get, set, hasMigrationSources(loaded));
    const profile = await getCloudProfile(uid).catch(() => null);
    get().hydrateProfile(resolveProfile(profile, auth?.currentUser ?? null));
    get().hydrateGratitudeNudgeAck(profile?.gratitudeNudgeAckedThrough ?? null);
    get().hydrateQuietMode(profile?.quietMode ?? true);
    set({ ready: true }); // name known — safe to render the app / ProfileStep
    await get().refreshGcalStatus(); // server-owned GCal connection status
    get().hydrateShowGoogleEvents(await loadShowGoogleEvents(uid)); // display pref (profile)
    get().ensureUpcoming(14);
  } catch {
    set({ loadFailed: true, ready: true }); // hydrate-failed → full-screen retry
  }
}

async function hasDirtySandbox(): Promise<boolean> {
  const hasRows = !(await new DexieAdapter().isEmpty());
  return isSandboxDirty(await getSandboxDirty(), hasRows);
}

async function resetToSignedOut(set: (p: Partial<RootState>) => void, get: () => RootState) {
  (persistence as RoutingAdapter).setDelegate(new DexieAdapter());
  await get().clearLocal();
  void setSandboxDirty(false);
  get().hydrateGcalStatus(null);
  get().hydrateShowGoogleEvents(true);
  get().hydrateQuietMode(readLocalQuietMode());
  get().hydrateGratitudeNudgeAck(readLocalGratitudeNudgeAck());
  get().setOnboarded(false);
  get().hydrateProfile({
    name: "Operator",
    email: "",
    avatar: "",
    workspace: "Personal workspace",
    partnerName: "",
  });
  set({
    ...createEmptyDataset(),
    cardPrefs: DEFAULT_CARD_PREFS,
    pendingSignIn: null,
    loadFailed: false,
    ready: true,
  });
}

async function applyAuthTransition(
  transition: AuthTransition,
  uid: string | null,
  set: (p: Partial<RootState>) => void,
  get: () => RootState,
) {
  switch (transition) {
    case "initial-sandbox":
      (persistence as RoutingAdapter).setDelegate(new DexieAdapter());
      await get().bootstrap();
      return;
    case "initial-account":
    case "switch-account":
    case "sign-in":
      if (uid) await loadAccount(uid, set, get);
      return;
    case "sign-out":
      await resetToSignedOut(set, get);
      return;
    case "noop":
      return;
  }
}

/** Per-collection ordering + read-normalization applied on every load (boot, account hydrate, refetch). */
function sortDataset(dataset: Partial<Dataset>): Partial<Dataset> {
  const out: Partial<Dataset> = { ...dataset };
  // Normalize archivedAt on read: records created before archiving lack the field
  // (undefined); coerce to null so they classify as active, not archived.
  if (dataset.values)
    out.values = dataset.values
      .map((v) => ({
        ...v,
        archivedAt: v.archivedAt ?? null,
        restingAt: v.restingAt ?? null,
        identity: v.identity ?? "",
      }))
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
    out.reviews = dataset.reviews
      .map(normalizeReview)
      .sort((a, b) => (a.periodKey < b.periodKey ? 1 : -1));
  if (dataset.journal)
    out.journal = [...dataset.journal].sort((a, b) => (a.date < b.date ? 1 : -1));
  return out;
}

/** Backend rows arrive without the server's field stamps; the client only ever holds an empty map. */
function withEmptyStamps(dataset: Partial<LoadedDataset>): Partial<Dataset> {
  const stamped: Partial<Record<CollectionName, unknown[]>> = {};
  for (const col of Object.keys(dataset) as CollectionName[]) {
    stamped[col] = dataset[col]?.map((row) =>
      row.fieldUpdatedAt ? row : { ...row, fieldUpdatedAt: {} },
    );
  }
  return stamped as Partial<Dataset>;
}

/** `cardPrefs` is one record in state but a collection on the wire, so the patch resolves it here. */
function toStatePatch(dataset: Partial<Dataset>): Partial<RootState> {
  const { cardPrefs, ...rest } = sortDataset(dataset);
  const patch = rest as Partial<RootState>;
  if (cardPrefs) patch.cardPrefs = resolveCardPrefs(cardPrefs);
  return patch;
}

/** Apply server truth reusing every unchanged row and collection, so subscribers of those don't re-render. */
function setChangedOnly(
  patch: Partial<RootState>,
  set: (p: Partial<RootState>) => void,
  get: () => RootState,
) {
  const state = get() as unknown as Record<string, unknown>;
  const changed: Record<string, unknown> = {};
  for (const [key, next] of Object.entries(patch)) {
    const prev = state[key];
    const merged =
      Array.isArray(prev) && Array.isArray(next)
        ? mergeRows(prev as { id: string }[], next as { id: string }[])
        : mergeRecord(prev, next);
    if (merged !== prev) changed[key] = merged;
  }
  if (Object.keys(changed).length > 0) set(changed as Partial<RootState>);
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
  ...createCardsSlice(set, get, api),
  ...createCardsBulkSlice(set, get, api),
  ...createFinanceSlice(set, get, api),
  ...createUiSlice(set, get, api),

  ready: false,
  authUid: null,
  authResolved: false,
  pendingSignIn: null,
  loadFailed: false,

  bootstrap: async () => {
    await persistence.init();
    const loaded = withEmptyStamps(await persistence.loadAll());
    set({ ...toStatePatch(loaded), ready: true });
    get().hydrateGcalStatus(null); // signed-out sandbox: no Google Calendar connection
    clearLegacyStreakRules();
    get().hydrateQuietMode(readLocalQuietMode());
    get().hydrateGratitudeNudgeAck(readLocalGratitudeNudgeAck());
    await runDataMigrations(get, set, hasMigrationSources(loaded));
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
    get().hydrateGratitudeNudgeAck(null);
    get().hydrateQuietMode(true);
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
      mindCards: seed.mindCards,
      mindMeta: [],
      cards: seed.cards,
      cardPrefs: resolveCardPrefs(seed.cardPrefs),
      financeAccounts: seed.financeAccounts,
      financeCategories: seed.financeCategories,
      financeBudgets: seed.financeBudgets,
      financeMerchants: seed.financeMerchants,
      financeImportBatches: seed.financeImportBatches,
      financeTransactions: seed.financeTransactions,
      financeSettlements: seed.financeSettlements,
    });
    void setSandboxDirty(false);
  },

  deleteAllData: async () => {
    await persistence.clearAll();
    set({ ...createEmptyDataset(), cardPrefs: DEFAULT_CARD_PREFS });
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
      mindCards: state.mindCards,
      mindMeta: state.mindMeta,
      financeAccounts: state.financeAccounts,
      financeCategories: state.financeCategories,
      financeBudgets: state.financeBudgets,
      financeMerchants: state.financeMerchants,
      financeImportBatches: state.financeImportBatches,
      financeTransactions: state.financeTransactions,
      financeSettlements: state.financeSettlements,
      cards: state.cards,
      cardPrefs: [state.cardPrefs],
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
    set(toStatePatch(next));
    return true;
  },

  // Realtime is off — signed-in clients pull server truth on focus + interval, and
  // after a rejected write to reconcile the reverted collection. Best-effort; a
  // failed refetch leaves the current store untouched.
  refetchAll: async () => {
    if (!get().authUid) return false;
    const guarded = pendingWriteCollections();
    try {
      const loaded = withEmptyStamps(await persistence.loadAll());
      for (const col of pendingWriteCollections()) guarded.add(col);
      const next = toStatePatch(loaded);
      for (const col of guarded) delete next[col];
      setChangedOnly(next, set, get);
      return guarded.size === 0;
    } catch {
      return false; // keep current state; next focus/interval retries
    }
  },

  // Poll the write-counter, not the dataset: one read answers "is there anything to fetch?", so an
  // idle tab costs a single document instead of the whole account.
  refetchIfChanged: async () => {
    if (!get().authUid) return;
    let version: number;
    try {
      version = await persistence.readSyncVersion();
    } catch {
      return; // treat an unreachable counter as "unknown", not as "unchanged"
    }
    const cursor = syncCursor;
    if (!cursor.shouldRefetch(version)) return;
    if (!(await get().refetchAll())) cursor.invalidate();
  },

  refetchCollection: async (col) => {
    if (!get().authUid || pendingWriteCollections().has(col)) return;
    try {
      const loaded = withEmptyStamps({ [col]: await persistence.load(col) });
      setChangedOnly(toStatePatch(loaded), set, get);
    } catch {
      /* best-effort reconcile */
    }
  },

  onAuthChange: async (uid: string | null) => {
    const transition = authTransition(get().authUid, uid, get().authResolved);
    // Dirty-sandbox sign-in parks WITHOUT committing auth or switching the delegate, so a
    // cancel (sign-out → onAuthChange(null)) is a noop; confirmPendingSignIn commits it.
    if (transition === "sign-in" && uid && (await hasDirtySandbox())) {
      set({ authResolved: true, pendingSignIn: uid });
      return;
    }
    setPersistAuth(uid);
    set({ authUid: uid, authResolved: true });
    await applyAuthTransition(transition, uid, set, get);
  },
}));

bindPersistStore(useStore);
