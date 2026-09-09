/** Which selection a staged import belongs to. The counter is what tells A→B→A from A. */
export interface StageStamp {
  accountId: string | null;
  selection: number;
}

/** Live only while the same account is still chosen *and* it was never left in between. */
export function isStampLive(stamp: StageStamp, live: StageStamp): boolean {
  return stamp.accountId === live.accountId && stamp.selection === live.selection;
}

export function advanceStamp(stamp: StageStamp, accountId: string | null): StageStamp {
  return stamp.accountId === accountId ? stamp : { accountId, selection: stamp.selection + 1 };
}
