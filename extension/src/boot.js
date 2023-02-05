"use strict";

const logger = console;
// eslint-disable-next-line no-console, @typescript-eslint/no-empty-function
logger.verbose = process.env.NODE_ENV === "production" ? () => {} : console.info;

/** FIXME: Check Manifest V3 compatibility */
function addScript(src) {
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = chrome.runtime.getURL(src);
  (document.head || document.body || document.documentElement).appendChild(script);
}

/**
 * View modes of GMail
 *
 * view=cm - Compose new message (full screen)
 * view=om - Show original message
 * view=cf - Add another email address that you own
 *
 * So we are only adding scripts to the view and full compose view.
 */
const view = new URL(document.location).searchParams.get("view");
if (!view || view === "cm") {
  logger.warn("Adding extension $VERSION.$BUILD_NUMBER.");
  addScript("src/extension.js");

  /**
   * Listens to custom event from injected script and send it to background script.
   * Injected script cannot access directly chrome extension APIs
   *
   * See more here:
   * https://stackoverflow.com/questions/9515704/use-a-content-script-to-access-the-page-context-variables-and-functions
   **/
  document.addEventListener("extensionSendBackgroundMessage", function (event) {
    const json = JSON.parse(event.detail);
    logger.verbose("Sending background message", json);
    chrome.runtime.sendMessage(json);
  });

  /**
   * Send response back to injected script
   **/
  chrome.runtime.onMessage.addListener((msg) => {
    logger.verbose("Received message", msg);
    alert("Received " + JSON.stringify(msg))
    document.dispatchEvent(
      new CustomEvent("extensionReceiveBackgroundMessage", {
        detail: JSON.stringify(msg),
      })
    );
  });
}
