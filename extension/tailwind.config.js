const plugin = require("tailwindcss/plugin");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  plugins: [
    plugin(({ addVariant }) => {
      // Add a `third` variant, ie. `third:pb-0`
      addVariant("selected", '&[data-selected="1"]');
    }),
  ],
  corePlugins: {
    /**
     * Base CSS styles which are applied EVERYWHERE.
     * @see https://tailwindcss.com/docs/preflight#images-are-block-level
     * @see https://github.com/tailwindlabs/tailwindcss/blob/master/src/css/preflight.css
     */
    preflight: true,
  },
};
