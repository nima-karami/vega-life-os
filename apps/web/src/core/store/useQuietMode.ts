import { useStore } from "./store";

export const useQuietMode = (): boolean => useStore((s) => s.quietMode);
