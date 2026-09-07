import { BadRequestError } from "./requestValidation.mjs";
import { safelyRecordSystemEvent } from "./systemEventRepository.mjs";

const parserErrors = new Map([
  ["entity.parse.failed", [400, "Invalid request body"]],
  ["entity.too.large", [413, "Request body is too large"]],
  ["encoding.unsupported", [415, "Unsupported content encoding"]],
  ["charset.unsupported", [415, "Unsupported character encoding"]],
  ["request.aborted", [400, "Request was aborted"]],
  ["request.size.invalid", [400, "Invalid request size"]],
]);

export function createApiErrorHandler(pool, config, versionMetadata) {
  return async (error, request, response, next) => {
    if (response.headersSent) return next(error);
    if (error instanceof BadRequestError) {
      response.status(400).json({ error: error.message });
      return;
    }
    const parserError = parserErrors.get(error.type);
    if (parserError) {
      response.status(parserError[0]).json({ error: parserError[1] });
      return;
    }
    if (error instanceof URIError) {
      response.status(400).json({ error: "Invalid URL encoding" });
      return;
    }
    console.error(error);
    if ((request.originalUrl ?? request.url) !== "/api/health") {
      await safelyRecordSystemEvent(pool, {
        eventType: "error", severity: "error", source: "api", status: "failed",
        message: error instanceof Error ? error.message : "Unhandled API error.",
        detail: error instanceof Error ? error.stack : String(error),
        requestMethod: request.method, requestPath: request.originalUrl ?? request.url,
        responseStatus: 500, actorEmail: request.user?.email, actorRole: request.user?.role,
        environment: config.appEnv, appVersion: versionMetadata.version,
        metadata: { gitSha: versionMetadata.gitSha },
      });
    }
    response.status(500).json({ error: "Internal server error" });
  };
}
