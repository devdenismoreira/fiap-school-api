export type LogContext = Record<string, unknown>;

export interface Logger {
  info(context: LogContext, message: string): void;
  error(context: LogContext, message: string): void;
}
