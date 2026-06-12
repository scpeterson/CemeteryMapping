import { purgeAuditEvents } from "./auditRepository.mjs";
import { purgeSystemEvents, safelyRecordJobRun } from "./systemEventRepository.mjs";

function jobContext(input = {}) {
  return {
    actorEmail: input.actorUser?.email,
    actorRole: input.actorUser?.role,
    environment: input.environment,
    appVersion: input.appVersion,
    metadata: {
      trigger: input.trigger ?? "manual",
      gitSha: input.gitSha,
    },
  };
}

async function runRetentionPurgeJob(pool, options) {
  const startedAt = Date.now();
  const context = jobContext(options);

  await safelyRecordJobRun(pool, {
    source: options.source,
    status: "started",
    message: `${options.label} purge started.`,
    ...context,
  });

  try {
    const result = await options.purge(pool);
    const durationMs = Date.now() - startedAt;
    await safelyRecordJobRun(pool, {
      source: options.source,
      status: "succeeded",
      message: `${options.label} purge completed. Deleted ${result.deletedCount} event${result.deletedCount === 1 ? "" : "s"}.`,
      durationMs,
      ...context,
      metadata: {
        ...context.metadata,
        ...result,
      },
    });
    return {
      durationMs,
      ...result,
    };
  } catch (error) {
    await safelyRecordJobRun(pool, {
      source: options.source,
      status: "failed",
      message: error instanceof Error ? error.message : `${options.label} purge failed.`,
      detail: error instanceof Error ? error.stack : String(error),
      durationMs: Date.now() - startedAt,
      ...context,
    });
    throw error;
  }
}

export function runAuditRetentionPurgeJob(pool, options = {}) {
  return runRetentionPurgeJob(pool, {
    label: "Audit retention",
    source: "db:purge:audit",
    purge: purgeAuditEvents,
    ...options,
  });
}

export function runSystemEventRetentionPurgeJob(pool, options = {}) {
  return runRetentionPurgeJob(pool, {
    label: "System event retention",
    source: "db:purge:system-events",
    purge: purgeSystemEvents,
    ...options,
  });
}
