/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-empty-function */

interface Logger {
  isAudit: boolean;
  isVerbose: boolean;
  isDump: boolean;
  audit: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  verbose: (...args: unknown[]) => void;
  dump: (filename: string, contents: unknown) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/** Prefix logger output */
const _prefix = process.env.GIT_TAGS || "dev";

/** Import fs package, or create a thunk method */
const fs =
  typeof window !== "undefined"
    ? {
        writeFileSync: (name: string, contents: string) => {
          console.log("FILE", name, contents);
        }
      }
    : eval('require("fs")');

/**
 * Universal logger based on console. Also supports logger.verbose()
 * and level testing properties, i.e. logger.isVerbose || false
 *
 * Usage:
 * ```
 * import logger from "@/lib/logger"
 * logger.info(...)
 * logger.verbose(...)
 *
 * if (logger.isVerbose) {
 *  logger.verbose(...)
 * }
 * ```
 */
const logger: Logger = {
  isAudit:
    process.env.LOG_AUDIT &&
    (process.env.LOG_AUDIT === "1" || process.env.LOG_AUDIT === "true")
      ? true
      : false,
  isVerbose:
    process.env.LOG_VERBOSE &&
    (process.env.LOG_VERBOSE === "1" || process.env.LOG_VERBOSE === "true")
      ? true
      : false,
  isDump:
    process.env.LOG_DUMP && (process.env.LOG_DUMP === "1" || process.env.LOG_DUMP === "true")
      ? true
      : false,
  info:
    process.env.LOG_INFO === undefined ||
    process.env.LOG_INFO === "1" ||
    process.env.LOG_INFO === "true"
      ? console.info.bind(console.info, _prefix + " %s")
      : () => {},
  audit:
    process.env.LOG_AUDIT &&
    (process.env.LOG_AUDIT === "1" || process.env.LOG_AUDIT === "true")
      ? console.info.bind(console.info, "AUDIT " + _prefix + " %s")
      : () => {},
  verbose:
    process.env.LOG_VERBOSE &&
    (process.env.LOG_VERBOSE === "1" || process.env.LOG_VERBOSE === "true")
      ? console.info.bind(console.info, "DEBUG " + _prefix + " %s")
      : () => {},
  dump: (filename, contents) => fs.writeFileSync(filename, contents),
  warn: console.warn.bind(console.info, _prefix + " %s"),
  error: console.error.bind(console.info, _prefix + " %s")
};

export default logger;
