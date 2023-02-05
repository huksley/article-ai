/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Missing and additional types for Typescript.
 */

declare module "*.json" {
  const value: any;
  export default value;
}

declare module "*.png" {
  const value: string;
  export = value;
}

declare module "*.svg" {
  const value: string;
  export = value;
}

declare module "*.css" {
  const value: string;
  export = value;
}

// FIXME: proper types
declare module "page-metadata-parser" {
  const getMetadata: any;
  const metadataRuleSets: any;
  export { getMetadata, metadataRuleSets };
}
