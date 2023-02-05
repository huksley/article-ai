const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");
const dotenv = require("dotenv");
const paths = require("./src/tsconfig-paths");
const { WebpackPlugin: GenerateStyledCssPlugin } = require("./src/generate-wrapper");

const createBuildNumber = () => {
  // Reuse last build date
  const date =
    process.env.NODE_ENV === "production" && process.env.FROZEN_TIMESTAMP
      ? new Date(parseInt(process.env.FROZEN_TIMESTAMP, 10))
      : process.env.NODE_ENV === "production"
      ? new Date(FROZEN_TIMESTAMP)
      : new Date();

  const pad = (v) => String(v).padStart(2, "0");
  // Mozilla requires number not be prepeneded with zeroes in version
  const nopad = (v) => String(v);

  return (
    // 101....1231
    [nopad(date.getMonth() + 1), pad(date.getDate())].join("") +
    "." + // 2359
    [nopad(date.getHours()), pad(date.getMinutes())].join("")
  );
};

const manifest = require("./manifest.json");
const package = require("./package.json");
const majorMinor = package.version.split(".");
majorMinor.splice(2, 1);

const env = new webpack.EnvironmentPlugin({
  GIT_TAGS: process.env.GIT_TAGS || "dev",
  EXTENSION_URL:
    process.env.EXTENSION_URL ||
    `https://chrome.google.com/webstore/detail/${manifest.short_name}/inbhlhnaeeggeicaockcoigiohagecfd`,
  LOG_AUDIT: process.env.NODE_ENV === "production" ? "0" : "1",
  LOG_DUMP: "0",
  LOG_VERBOSE: process.env.NODE_ENV === "production" ? "0" : "1",
  LOG_INFO: process.env.NODE_ENV === "production" ? "1" : "1",
  NODE_ENV: process.env.NODE_ENV || "development",
  VERSION: majorMinor.join("."),
});

/** @type {import('webpack').Configuration} */
module.exports = {
  /**
   * inline-source-map - works in chrome, supported by DevTools, no errors
   * source-map - DevTools failed to load SourceMap: Could not load content
   */
  devtool: process.env.NODE_ENV === "production" ? undefined : "inline-source-map",
  watchOptions: {
    aggregateTimeout: 600,
    ignored: [
      "**/node_modules",
      path.resolve(__dirname, "build"),
      path.resolve(__dirname, "dist"),
      "./extension-stats.json",
    ],
  },
  entry: {
    extension: "./src/extension",
    background: "./src/background",
    popup: "./src/popup",
    install: "./src/install",
  },
  optimization: {
    minimize: false,
    innerGraph: true,
    mangleExports: false,
    sideEffects: true,
    usedExports: true,
    // By default true, but makes it difficult to see tree by using `npx webpack-bundle-analyzer extension-stats.json`
    // https://webpack.js.org/plugins/module-concatenation-plugin/
    // https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/158
    concatenateModules: false,
  },
  module: {
    rules: [
      {
        test: /\.(ico|jpg|jpeg|png|apng|gif|eot|otf|webp|ttf|woff|woff2|cur|ani|pdf)?$/,
        type: "asset/resource",
        generator: {
          filename: "assets/[name][ext]",
        },
      },
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        loader: "babel-loader",
      },
      {
        test: /\.(svg)$/i,
        loader: "url-loader",
      },
      {
        test: /\.(scss|css)$/i,
        use: [
          {
            loader: "style-loader",
            options: {
              insert: (_styleTag, ...opts) => {
                // eslint-disable-next-line no-console
                console.warn("Unsupported global CSS import", opts);
                throw new Error("Unsupported global CSS import: " + opts?.join(", "));
              },
            },
          },
          "css-loader",
          "resolve-url-loader",
          {
            loader: "postcss-loader",
            options: {
              sourceMap: true,
            },
          },
          {
            loader: "sass-loader",
            options: {
              sourceMap: true,
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    // Based on tsconfig.json aliases
    alias: {
      ...paths(),
    },
  },
  output: {
    path: path.join(__dirname, "build"),
    filename: "src/[name].js",
  },
  plugins: [
    env,
    new GenerateStyledCssPlugin(),
    // Handles all undefined variables for Webpack5,
    // NextJS on both client side and server side uses a lots of them,
    // https://github.com/vercel/next.js/blob/master/packages/next/build/webpack-config.ts#L1133
    new webpack.DefinePlugin({
      "process.env":
        process.env.NODE_ENV === "production"
          ? `new Proxy(
        {},
        {
          get(target, prop) {
            return undefined;
          }
        }
      )`
          : `new Proxy(
        {},
        {
          get(target, prop) {
            console.warn(\`Missing process.env.\${prop}\`);
            return undefined;
          }
        }
      )`,
    }),
    new CopyPlugin({
      patterns: [
        {
          from: "src/boot.js",
          to: "src/",
          transform(content) {
            return content
              .toString()
              .replace(/process\.env\.NODE_ENV/g, JSON.stringify(process.env.NODE_ENV || "development"))
              .replace(/\$BUILD_NUMBER/g, createBuildNumber())
              .replace(/\$VERSION/g, majorMinor.join("."));
          },
        },
        {
          from: "manifest.json",
          transform(content) {
            return content
              .toString()
              .replace(/\$BUILD_NUMBER/g, createBuildNumber())
              .replace(/\$VERSION/g, majorMinor.join("."));
          },
        },
        { from: "src/popup-fix.js", to: "src/" },
        {
          from: "*.html",
          to: "[name][ext]",
          transform(content) {
            return content
              .toString()
              .replace(/\$BUILD_NUMBER/g, createBuildNumber())
              .replace(/\$VERSION/g, majorMinor.join("."));
          },
        },
        { from: "images", to: "images/" },
      ],
    }),
  ],
};
