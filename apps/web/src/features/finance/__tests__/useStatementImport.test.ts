// @vitest-environment jsdom
import type { FinanceAccount } from "@vega/shared";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedStatement, ParseOutcome } from "../import/types";
import type { FinanceImportOutcome } from "../store";
import {
  type ImportPhase,
  type StagedFile,
  type StatementImport,
  useStatementImport,
} from "../useStatementImport";

/**
 * The subject is the phase machine, not the parser: both async steps are held open by the test so
 * the account can be moved at an exact point, with no timing left to the digest or the event loop.
 */
const held = vi.hoisted(() => ({
  parses: [] as ((outcome: ParseOutcome) => void)[],
  commits: [] as ((outcome: FinanceImportOutcome) => void)[],
  writtenTo: [] as (string | undefined)[],
  state: {
    financeMerchants: [],
    financeTransactions: [],
    updateFinanceAccount: () => {},
    rollBackFinanceImport: async () => {},
    importFinanceTransactions: (input: { batch: { accountId?: string } }) => {
      held.writtenTo.push(input.batch.accountId);
      return new Promise<FinanceImportOutcome>((resolve) => held.commits.push(resolve));
    },
    pushToast: () => {},
  },
}));

vi.mock("@/core/store", () => ({
  useStore: (select: (state: typeof held.state) => unknown) => select(held.state),
}));

vi.mock("../import/parse", () => ({
  parseStatement: () => new Promise<ParseOutcome>((resolve) => held.parses.push(resolve)),
}));

vi.mock("../import-staging", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../import-staging")>()),
  computeFileHash: async () => "unit-file-hash",
}));

const buildAccount = (id: string): FinanceAccount => ({
  id,
  slug: id,
  displayName: id,
  kind: "chequing",
  isBusiness: false,
  columnMapping: null,
  archivedAt: null,
  updatedAt: "",
  fieldUpdatedAt: {},
});

const ACCOUNT_A = buildAccount("facc_a");
const ACCOUNT_B = buildAccount("facc_b");

const STATEMENT: ParsedStatement = {
  file: "unit-statement.csv",
  layoutId: "unit-layout",
  mapping: {
    dateColumn: "Transaction Date",
    descriptionColumn: "Description 1",
    amountColumn: "CAD$",
    debitColumn: null,
    creditColumn: null,
    dateFormat: "MM/dd/yyyy",
    debitsArePositive: false,
    hasHeaderRow: true,
  },
  workedExample: null,
  rows: [],
  nearDuplicates: [],
  counts: {
    parsed: 2,
    newRows: 2,
    duplicate: 0,
    internal: 0,
    unknownMerchant: 0,
    nearDuplicate: 0,
  },
};

const FILE = {
  name: "unit-statement.csv",
  size: 128,
  text: async () => "Transaction Date,Description 1,CAD$",
} as unknown as File;

let container: HTMLDivElement;
let root: Root;
let flow: StatementImport;

function Probe({ account }: { account: FinanceAccount | null }) {
  flow = useStatementImport(account);
  return null;
}

const render = async (account: FinanceAccount) => {
  await act(async () => {
    root.render(createElement(Probe, { account }));
  });
};

/** Everything up to the parse resolves on microtasks — the file read, the hash, each mocked step. */
const settleMicrotasks = async () => {
  await act(async () => {
    for (let pass = 0; pass < 8; pass += 1) await Promise.resolve();
  });
};

/** The parse waits for a painted frame before it starts, so the frame clock is part of the wait. */
const drain = async () => {
  await act(async () => {
    for (let pass = 0; pass < 8; pass += 1) {
      await vi.advanceTimersByTimeAsync(100);
      await Promise.resolve();
    }
  });
};

/** Stops in the paint window: the notice is up, the thread has not been handed to the parse yet. */
const openHeldFileToParsingWindow = async () => {
  await act(async () => {
    flow.openFiles([FILE] as unknown as FileList);
  });
  await settleMicrotasks();
};

const openHeldFile = async () => {
  await openHeldFileToParsingWindow();
  await drain();
};

/** Queued in the order the files were opened, so a later one can be answered first. */
const releaseParse = async (queued = 0) => {
  await act(async () => {
    held.parses.splice(queued, 1)[0]?.({ status: "parsed", statement: STATEMENT });
  });
  await drain();
};

const releaseCommit = async (outcome: FinanceImportOutcome) => {
  await act(async () => {
    held.commits.shift()?.(outcome);
  });
  await drain();
};

/** The account whose rows are staged, or the phase's own name when none are — one readable diff. */
const stagedAccount = (phase: ImportPhase) =>
  phase.status === "preview" ? phase.staged.accountId : phase.status;

const stagePreview = async (): Promise<StagedFile> => {
  await openHeldFile();
  await releaseParse();
  if (flow.phase.status !== "preview") throw new Error(`staged as ${flow.phase.status}`);
  return flow.phase.staged;
};

beforeEach(() => {
  // only the clocks the parse yields on: React's own scheduler must keep its real one
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"],
  });
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  held.parses.length = 0;
  held.commits.length = 0;
  held.writtenTo.length = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  // drops any parse still waiting in its paint window, so it cannot resume against the next test
  vi.useRealTimers();
});

describe("useStatementImport while the chosen account moves", () => {
  it("stages the file when the account holds — the control the drops are read against", async () => {
    await render(ACCOUNT_A);
    const staged = await stagePreview();

    expect(staged.fileName).toBe("unit-statement.csv");
  });

  it("hands the thread back once the notice is up, before the parse takes it", async () => {
    await render(ACCOUNT_A);
    await openHeldFileToParsingWindow();

    expect(flow.phase).toEqual({ status: "parsing", fileName: "unit-statement.csv" });
    expect(held.parses, "the parse took the thread without letting its notice paint").toHaveLength(
      0,
    );
  });

  it("drops a parse abandoned in the window the notice paints in", async () => {
    await render(ACCOUNT_A);
    await openHeldFileToParsingWindow();
    expect(held.parses, "there was no window left to abandon the parse in").toHaveLength(0);

    await render(ACCOUNT_B);
    await drain();
    await releaseParse();

    expect(flow.phase.status).toBe("idle");
    expect(held.writtenTo, "the abandoned parse wrote under the account moved to").toEqual([]);

    await render(ACCOUNT_A);
    expect(flow.phase.status).toBe("idle");
  });

  it("drops a parse that lands after the account moved", async () => {
    await render(ACCOUNT_A);
    await openHeldFile();

    await render(ACCOUNT_B);
    await releaseParse();

    expect(flow.phase.status).toBe("idle");
  });

  it("drops a parse that lands after the account was left and chosen again", async () => {
    await render(ACCOUNT_A);
    await openHeldFile();

    await render(ACCOUNT_B);
    await render(ACCOUNT_A);
    await releaseParse();

    expect(flow.phase.status).toBe("idle");
  });

  it("keeps the staged preview gone on the way back to the account that staged it", async () => {
    await render(ACCOUNT_A);
    await stagePreview();

    await render(ACCOUNT_B);
    await render(ACCOUNT_A);

    expect(flow.phase.status).toBe("idle");
  });

  it("reports a finished commit when the account holds", async () => {
    await render(ACCOUNT_A);
    const staged = await stagePreview();

    await act(async () => {
      flow.commit(staged);
    });
    await releaseCommit({ writtenRows: 2, writtenChunks: 1, failedChunk: null });

    expect(flow.phase).toEqual({ status: "committed", inserted: 2, skipped: 0 });
  });

  it("never renders a finished commit under the account it did not write to", async () => {
    await render(ACCOUNT_A);
    const staged = await stagePreview();

    await act(async () => {
      flow.commit(staged);
    });
    await render(ACCOUNT_B);
    await releaseCommit({ writtenRows: 2, writtenChunks: 1, failedChunk: null });

    expect(flow.phase.status).toBe("idle");
  });

  it("never offers a partial commit's retry under the account it did not write to", async () => {
    await render(ACCOUNT_A);
    const staged = await stagePreview();

    await act(async () => {
      flow.commit(staged);
    });
    await render(ACCOUNT_B);
    await releaseCommit({ writtenRows: 1, writtenChunks: 1, failedChunk: 2 });

    expect(flow.phase.status).toBe("idle");
  });

  it("still reports the partial commit once its own account is chosen back", async () => {
    await render(ACCOUNT_A);
    const staged = await stagePreview();

    await act(async () => {
      flow.commit(staged);
    });
    await render(ACCOUNT_B);
    await releaseCommit({ writtenRows: 1, writtenChunks: 1, failedChunk: 2 });
    await render(ACCOUNT_A);

    expect(flow.phase.status).toBe("partial-commit");
  });

  it("leaves the live account's preview standing when another account's commit lands", async () => {
    await render(ACCOUNT_A);
    const staged = await stagePreview();
    await act(async () => {
      flow.commit(staged);
    });

    await render(ACCOUNT_B);
    await stagePreview();
    await releaseCommit({ writtenRows: 2, writtenChunks: 1, failedChunk: null });

    expect(stagedAccount(flow.phase)).toBe(ACCOUNT_B.id);
  });

  it("still reports that commit on the way back, though another account staged in between", async () => {
    await render(ACCOUNT_A);
    const staged = await stagePreview();
    await act(async () => {
      flow.commit(staged);
    });

    await render(ACCOUNT_B);
    await stagePreview();
    await releaseCommit({ writtenRows: 2, writtenChunks: 1, failedChunk: null });
    await render(ACCOUNT_A);

    expect(flow.phase).toEqual({ status: "committed", inserted: 2, skipped: 0 });
  });

  it("leaves the live account's preview standing when an older parse lands last", async () => {
    await render(ACCOUNT_A);
    await openHeldFile();

    await render(ACCOUNT_B);
    await openHeldFile();
    await releaseParse(1);
    await releaseParse(0);

    expect(stagedAccount(flow.phase)).toBe(ACCOUNT_B.id);
  });

  it("retries the staged rows into the account they were parsed under", async () => {
    await render(ACCOUNT_A);
    const staged = await stagePreview();

    await act(async () => {
      flow.commit(staged);
    });
    await releaseCommit({ writtenRows: 1, writtenChunks: 1, failedChunk: 2 });
    await render(ACCOUNT_B);
    await act(async () => {
      flow.commit(staged);
    });

    expect(held.writtenTo).toEqual([ACCOUNT_A.id, ACCOUNT_A.id]);
  });
});
