// Structured logs for the email pipeline: one JSON object per line, which the
// Supabase function logs (and any log drain) can filter by field.
//
// Never logged: tokens, authorization headers, message bodies. Fields whose
// name suggests one of those are replaced with "[redacted]" whatever the
// caller passed, so a careless call site cannot leak them.

export type LogValue = string | number | boolean | null | undefined;
export type LogFields = Record<string, LogValue>;

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  /** Counter-style metric: emails_received, tickets_created_from_email... */
  metric(name: string, value?: number, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

export type LogSink = (level: "info" | "warn" | "error", line: string) => void;

const SENSITIVE_FIELD =
  /token|secret|password|authorization|cookie|body|html|content|code_verifier/i;

function redact(fields: LogFields): LogFields {
  const out: LogFields = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    out[key] = SENSITIVE_FIELD.test(key) ? "[redacted]" : value;
  }

  return out;
}

const consoleSink: LogSink = (level, line) => {
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

export function createLogger(
  base: LogFields = {},
  sink: LogSink = consoleSink,
): Logger {
  const write = (
    level: "info" | "warn" | "error",
    event: string,
    fields: LogFields = {},
  ) => {
    sink(
      level,
      JSON.stringify({
        level,
        event,
        ts: new Date().toISOString(),
        ...redact(base),
        ...redact(fields),
      }),
    );
  };

  return {
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
    metric: (name, value = 1, fields) =>
      write("info", "metric", { metric: name, value, ...fields }),
    child: (fields) => createLogger({ ...base, ...fields }, sink),
  };
}

/** For tests and callers that want silence. */
export const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  metric: () => {},
  child: () => noopLogger,
};
