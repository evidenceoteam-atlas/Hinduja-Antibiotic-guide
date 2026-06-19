export type ProtocolDataErrorCode =
  | "permission_denied"
  | "network_failure"
  | "schema_failure";

export type ProtocolQueryErrorResult = {
  status: "data_error";
  code: ProtocolDataErrorCode;
  message: string;
};

export function classifyProtocolQueryError(error: {
  code?: string;
  message?: string;
  status?: number;
}): ProtocolQueryErrorResult {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  if (
    error.status === 401 ||
    error.status === 403 ||
    code === "42501" ||
    message.includes("permission") ||
    message.includes("jwt")
  ) {
    return {
      status: "data_error",
      code: "permission_denied",
      message: "Approved protocol data could not be accessed. Contact support and use the institutional guide.",
    };
  }
  if (
    error.status === 408 ||
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("timeout")
  ) {
    return {
      status: "data_error",
      code: "network_failure",
      message: "Approved protocol data could not be reached. Check connectivity and use the institutional guide.",
    };
  }
  return {
    status: "data_error",
    code: "schema_failure",
    message: "Approved protocol data is temporarily unavailable. Contact support and use the institutional guide.",
  };
}
