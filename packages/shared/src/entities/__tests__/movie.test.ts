import { movieCreateSchema, movieSchema } from "../movie";
import { describeEntityContract } from "./entity-contract";

describeEntityContract("movie", {
  schema: movieSchema,
  createSchema: movieCreateSchema,
  valid: {
    id: "m_1",
    title: "Arrival",
    year: 2016,
    director: "Denis Villeneuve",
    status: "watched",
    rating: 5,
    watchedAt: "2026-07-10",
    note: "",
    order: 0,
    updatedAt: "2026-07-13T10:00:00.000Z",
    fieldUpdatedAt: { title: "2026-07-13T10:00:00.000Z" },
  },
});
