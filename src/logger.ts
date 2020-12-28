export type Logger = ((...args: unknown[]) => void) & {
  child: (namespace: string) => Logger;
};

export function createLogger(
  namespace: string,
  baseLogger = console.log
): Logger {
  const logger: Logger = Object.assign(
    baseLogger.bind(null, `[${namespace}]`),
    {
      child: (namespace: string) => createLogger(namespace, logger),
    }
  );
  return logger;
}
