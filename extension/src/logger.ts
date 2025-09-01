/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-empty-function */

interface Logger {
  isVerbose: boolean;
  info: (...args: unknown[]) => void;
  verbose: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Universal logger based on console. Also supports logger.verbose()
 * and level testing properties, i.e. logger.isVerbose || false
 */
const logger: Logger = {
  isVerbose: process.env.LOG_VERBOSE === "1" ? true : false,
  info: console.info.bind(console.info, "%s"),
  verbose: process.env.LOG_VERBOSE === "1" ? console.info.bind(console.info, "DEBUG %s") : () => {},
  warn: console.warn.bind(console.info, "%s"),
  error: console.error.bind(console.info, "%s"),
};

export default logger;
