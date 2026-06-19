import { classifyProtocolQueryError } from "./protocolScenarioCore";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const status of [401, 403]) {
  assert(
    classifyProtocolQueryError({ status }).code === "permission_denied",
    `${status} must be permission_denied`,
  );
}
assert(
  classifyProtocolQueryError({ status: 408 }).code === "network_failure",
  "408 must be network_failure",
);
assert(
  classifyProtocolQueryError({ message: "request timeout" }).code === "network_failure",
  "timeout must be network_failure",
);
for (const status of [404, 500]) {
  assert(
    classifyProtocolQueryError({ status }).code === "schema_failure",
    `${status} must fail as schema/operational data error`,
  );
}
