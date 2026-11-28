/** Short, sortable-ish unique id for new entities created at runtime. */
export function uid(prefix = ""): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 7);
  return `${prefix}${t}${r}`;
}
