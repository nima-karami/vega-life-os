import type { StateCreator } from "zustand";
import type { RootState } from "./types";

/** A feature slice operating on the shared root store. */
export type Slice<T> = StateCreator<RootState, [], [], T>;
