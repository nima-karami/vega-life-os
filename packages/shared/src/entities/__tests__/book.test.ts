import { bookCreateSchema, bookSchema } from "../book";
import { describeEntityContract } from "./entity-contract";

describeEntityContract("book", {
  schema: bookSchema,
  createSchema: bookCreateSchema,
  valid: {
    id: "b_1",
    title: "Deep Work",
    author: "Cal Newport",
    status: "reading",
    rating: null,
    pages: 300,
    currentPage: 120,
    startedAt: "2026-07-01",
    finishedAt: null,
    valueId: "v_1",
    note: "",
    order: 0,
    updatedAt: "2026-07-13T10:00:00.000Z",
    fieldUpdatedAt: { title: "2026-07-13T10:00:00.000Z" },
  },
});
