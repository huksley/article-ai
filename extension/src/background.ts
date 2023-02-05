import logger from "./logger";
import browser, { WebRequest } from "webextension-polyfill";

/**
 * Runs on install of new version of browser extension.
 *
 * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions
 */
browser.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
  logger.info(
    "Installed (" + reason + ")",
    browser.runtime.getManifest().version,
    "previousVersion",
    previousVersion,
    "manifest",
    browser.runtime.getManifest()
  );

  if (reason === "install") {
    browser.tabs.create({ url: "./install.html" });
  }
});

/**
 * Handles a message from extension code running in GMail.
 * Responds when needed.
 *
 * There is also debugging purposes only storybook implementation exists, see
 * ../../.storybook/preview.js
 */
browser.runtime.onMessage.addListener((msg: Record<string, unknown> & { action: string }, sender) => {
  logger.info("Received background message", msg, "from", sender);
  const senderTabId = sender.tab?.id;
  if (msg && msg.action && senderTabId) {
    const action = msg.action;
    if (action === "getState") {
      browser.storage.local
        .get("state")
        .then((values) => {
          const state = values.state;
          logger.info("Retrieved state from storage", state);
          if (state) {
            browser.tabs.sendMessage(senderTabId, {
              action: msg.action + ":response",
              state,
            });
          } else {
            browser.tabs.sendMessage(senderTabId, {
              action: msg.action + ":response",
              state: {},
            });
          }
        })
        .catch((err) => {
          logger.warn("Failed to get state from storage", err);
        });
    } else if (action === "setState") {
      browser.storage.local.set({ state: msg.state });
    } else if (action === "getManifest") {
      logger.info("Sending response, tab", senderTabId, "manifest", browser.runtime.getManifest());
      browser.tabs.sendMessage(senderTabId, {
        action: msg.action + ":response",
        manifest: browser.runtime.getManifest(),
      });
    } else {
      logger.warn("Unknown action", msg.action);
    }
  } else {
    logger.warn("Invalid message", msg, "or sender", sender);
  }
});
