import { describe, expect, it } from "vitest";
import { mergeWithFieldLww } from "../field-lww";

describe("mergeWithFieldLww (whole-record shape the client transmits)", () => {
  it("re-stamps only the fields whose value changed, preserving untouched fields' timestamps", () => {
    const stored = {
      id: "t1",
      title: "A",
      time: "09:00",
      fieldUpdatedAt: { title: "2026-07-13T10:00Z", time: "2026-07-13T10:00Z" },
    };
    const incoming = { id: "t1", title: "A", time: "14:00" };
    const { merged, fieldUpdatedAt } = mergeWithFieldLww(stored, incoming, "2026-07-13T11:00Z");
    expect(merged.time).toBe("14:00");
    expect(merged.title).toBe("A");
    expect(fieldUpdatedAt.time).toBe("2026-07-13T11:00Z");
    expect(fieldUpdatedAt.title).toBe("2026-07-13T10:00Z");
  });

  it("an identical whole-record upsert changes nothing and re-stamps no field", () => {
    const stored = {
      id: "t1",
      title: "A",
      time: "09:00",
      fieldUpdatedAt: { title: "2026-07-13T10:00Z", time: "2026-07-13T10:00Z" },
    };
    const incoming = { id: "t1", title: "A", time: "09:00" };
    const { merged, fieldUpdatedAt } = mergeWithFieldLww(stored, incoming, "2026-07-13T12:00Z");
    expect(merged).toMatchObject({ title: "A", time: "09:00" });
    expect(fieldUpdatedAt).toEqual(stored.fieldUpdatedAt);
  });

  it("stamps every field on a first insert (no prior record)", () => {
    const incoming = { id: "t1", title: "A", time: "09:00" };
    const { merged, fieldUpdatedAt } = mergeWithFieldLww(null, incoming, "2026-07-13T09:00Z");
    expect(merged.updatedAt).toBe("2026-07-13T09:00Z");
    expect(fieldUpdatedAt).toEqual({
      id: "2026-07-13T09:00Z",
      title: "2026-07-13T09:00Z",
      time: "2026-07-13T09:00Z",
    });
  });
});
