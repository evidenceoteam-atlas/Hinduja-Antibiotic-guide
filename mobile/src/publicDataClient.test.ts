import { supabase } from "./supabase";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const responses: unknown[][] = [
  [{ id: "one" }],
  [],
  [{ id: "one" }, { id: "two" }],
];
const requests: Array<{ headers: Headers; method: string; url: URL }> = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  requests.push({
    headers: new Headers(init?.headers),
    method: init?.method ?? "GET",
    url: new URL(String(input)),
  });
  return new Response(JSON.stringify(responses.shift() ?? []), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}) as typeof fetch;

void (async () => {
const listResult = await supabase
  .from("approved_rows")
  .select("*")
  .eq("status", "active")
  .in("kind", ["one", "two"])
  .order("name", { ascending: true })
  .limit(10);

assert(listResult.error === null, "approved list request must succeed");
assert(Array.isArray(listResult.data), "list requests must return arrays");
assert(requests[0]?.method === "GET", "public data client must use GET only");
assert(
  requests[0]?.headers.get("apikey") === "test-publishable-key",
  "public data request must include the publishable API key",
);
assert(
  !requests[0]?.headers.has("Authorization"),
  "public data request must not create an authorization session header",
);
assert(
  requests[0]?.url.searchParams.get("status") === "eq.active",
  "equality filters must be encoded for PostgREST",
);
assert(
  requests[0]?.url.searchParams.get("kind") === "in.(one,two)",
  "set filters must be encoded for PostgREST",
);
assert(
  requests[0]?.url.searchParams.get("order") === "name.asc",
  "sort order must be encoded for PostgREST",
);

const emptySingle = await supabase
  .from("approved_rows")
  .select("*")
  .eq("id", "missing")
  .maybeSingle();
assert(emptySingle.data === null, "zero-row maybeSingle must return null");
assert(emptySingle.error === null, "zero-row maybeSingle must not be an error");

const duplicateSingle = await supabase
  .from("approved_rows")
  .select("*")
  .maybeSingle();
assert(duplicateSingle.data === null, "multi-row maybeSingle must fail closed");
assert(
  duplicateSingle.error?.status === 406,
  "multi-row maybeSingle must report a cardinality error",
);
})();
