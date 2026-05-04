import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { graphql } from "ponder";

const app = new Hono();

// Auto-generated GraphQL endpoint for the bag + swap tables.
// Ponder builds queries (`bags`, `swaps`, `bag(bagId:)`, `swap(id:)`),
// filters, ordering, and pagination from ponder.schema.ts.
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

// CORS — frontend on Vercel calls this directly from the browser.
app.use("*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type");
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  await next();
});

app.get("/healthz", (c) => c.json({ ok: true }));

export default app;
