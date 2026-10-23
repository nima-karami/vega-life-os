import type { StoreApi } from "zustand";
import type { Slice } from "../slice";
import type { RootState } from "../types";

/** Rows a seed may carry: a fixture names only the fields the slice under test reads. */
export type SliceSeed = {
  [K in keyof RootState]?: RootState[K] extends (infer Row)[] ? Partial<Row>[] : RootState[K];
};

type StatePatch = RootState | Partial<RootState> | ((state: RootState) => Partial<RootState>);

/**
 * Drive one slice against a plain state object that stands in for the rest of the root store.
 * The seed overrides the slice's own initial values, as a loaded dataset would.
 */
export function createSliceHarness<T>(createSlice: Slice<T>, seed: SliceSeed = {}) {
  let state: RootState;
  const get = () => state;
  const set: StoreApi<RootState>["setState"] = (patch: StatePatch) => {
    state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  };
  const api: StoreApi<RootState> = {
    getState: get,
    getInitialState: get,
    setState: set,
    subscribe: () => () => {},
  };
  // The one unchecked step: one slice plus partial fixtures stand in for the whole root store.
  state = { ...createSlice(set, get, api), ...seed } as unknown as RootState;
  return { get };
}
