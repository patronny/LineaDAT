import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { graphql } from "ponder";

const app = new Hono();

// CORS - must run BEFORE GraphQL handlers, otherwise graphql() responds
// first and the Access-Control-* headers never get attached. Browser
// preflights (OPTIONS) also need to short-circuit here with 204.
app.use("*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type");
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  await next();
});

app.get("/healthz", (c) => c.json({ ok: true }));

// Auto-generated GraphQL endpoint for the bag + swap tables.
// Ponder builds queries (`bags`, `swaps`, `bag(bagId:)`, `swap(id:)`),
// filters, ordering, and pagination from ponder.schema.ts.
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

export default app;
