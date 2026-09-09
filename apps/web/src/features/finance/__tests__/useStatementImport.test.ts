// @vitest-environment jsdom
import type { FinanceAccount } from "@vega/shared";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedStatement, ParseOutcome } from "../import/types";
import type { FinanceImportOutcome } from "../store";
import { type StagedFile, type StatementImport, useStatementImport } from "../useStatementImport";

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

/** Both mocked steps resolve on microtasks, so draining them is the whole wait. */
const drain = async () => {
  await act(async () => {
    for (let pass = 0; pass < 8; pass += 1) await Promise.resolve();
  });
};

const openHeldFile = async () => {
  await act(async () => {
    flow.openFiles([FILE] as unknown as FileList);
  });
  await drain();
};

const releaseParse = async () => {
  await act(async () => {
    held.parses.shift()?.({ status: "parsed", statement: STATEMENT });
  });
  await drain();
};

const releaseCommit = async (outcome: FinanceImportOutcome) => {
  await act(async () => {
    held.commits.shift()?.(outcome);
  });
  await drain();
};

const stagePreview = async (): Promise<StagedFile> => {
  await openHeldFile();
  await releaseParse();
  if (flow.phase.status !== "preview") throw new Error(`staged as ${flow.phase.status}`);
  return flow.phase.staged;
};

beforeEach(() => {
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
});

describe("useStatementImport while the chosen account moves", () => {
  it("stages the file when the account holds — the control the drops are read against", async () => {
    await render(ACCOUNT_A);
    const staged = await stagePreview();

    expect(staged.fileName).toBe("unit-statement.csv");
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

  it("discards the staged preview rather than showing it again on the way back", async () => {
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
