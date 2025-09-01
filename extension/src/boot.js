"use strict";

function addScript(src) {
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = chrome.runtime.getURL(src);
  (document.head || document.body || document.documentElement).appendChild(script);
}

console.info("Adding extension $VERSION.$BUILD_NUMBER.");
addScript("src/extension.js");

/**
 * Deliver message from background script to content script.
 * Payload should be stringified JSON object.
 **/
chrome.runtime.onMessage.addListener((payload) =>
  document.dispatchEvent(new CustomEvent("receiveBackgroundMessage", { detail: JSON.stringify(payload) }))
);

/**
 * Deliver message from content script to background script.
 */
document.addEventListener("sendBackgroundMessage", (ev) => chrome.runtime.sendMessage(ev.detail));
