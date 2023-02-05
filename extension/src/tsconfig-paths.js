const { readFileSync } = require("fs");
const { resolve, dirname } = require("path");
const logger = console;

/**
 * Generates alias declaration for webpack from tsconfig.compilerOptions.paths
 * See more information at: https://www.typescriptlang.org/tsconfig#paths,
 *
 * Use by following snipped:
 *
 * ```
 * const paths = require("./tools/tsconfig-paths.js")
 *
 * module.export = {
 *  resolve: {
 *    alias: paths()
 *  }
 * }
 * ```
 */
const paths = file => {
  file = file || "./tsconfig.json";
  const json = readFileSync(file, { encoding: "utf8" });
  const tsconfig = JSON.parse(json);
  const config = {};
  if (!tsconfig.compilerOptions) {
    throw new Error("tsconfig have no compilerOptions");
  }

  if (!tsconfig.compilerOptions.paths) {
    throw new Error("tsconfig compilerOptions should be defined");
  }

  if (!tsconfig.compilerOptions.paths) {
    throw new Error("tsconfig compilerOptions.paths should be defined");
  }

  if (!tsconfig.compilerOptions.baseUrl) {
    throw new Error("tsconfig compilerOptions.baseUrl should be defined");
  }

  Object.entries(tsconfig.compilerOptions.paths).forEach(([path, mappings]) => {
    if (!path.startsWith("@/")) {
      throw new Error("tsconfig path " + path + " should start with @/...");
    }
    if (!path.endsWith("/*")) {
      throw new Error("tsconfig path " + path + " should end with /*");
    }

    if (!Array.isArray(mappings)) {
      throw new Error(
        "tsconfig path mapping for " + path + " should be an array: " + mappings
      );
    }

    if (mappings.length != 1) {
      throw new Error(
        "tsconfig path mapping for " + path + " should be 1 element array: " + mappings
      );
    }

    if (!mappings[0].endsWith("/*")) {
      throw new Error(
        "tsconfig path mapping for " + path + " should end with /*: " + mappings[0]
      );
    }

    // Remove /* from the end
    const alias = path.substring(0, path.length - 2);
    const baseUrl = resolve(dirname(file), tsconfig.compilerOptions.baseUrl);
    const dest = resolve(baseUrl, mappings[0].substring(0, mappings[0].length - 2));
    config[alias] = dest;
  });
  return config;
};

module.exports = paths;

if (require.main === module) {
  logger.info(paths());
}
