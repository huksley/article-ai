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

export type EventAction = "fetch" | "manifest" | "store";
export type EventUntyped = {
  type: EventAction;
  request: unknown;
  response: unknown;
};
export type EventWithCallback<T extends EventUntyped> = CustomEvent<T["request"]> & {
  callback: (result?: T["response"]) => void;
};

export type EventTypes = {
  manifest: {
    type: "manifest";
    request: {};
    response: {
      version: string;
    };
  };
  fetch: {
    type: "fetch";
    request: {
      url: string;
      method?: string;
      body?: unknown;
    };
    response: {
      ok: number;
      data: unknown;
    };
  };
  store: {
    type: "store";
    request: {
      key: string;
      value?: unknown;
    };
    response: {
      value: unknown;
    };
  };
};

const eventTarget = new EventTarget();
const src = {
  addEventListener: <T extends EventUntyped>(type: T["type"], listener: (event: EventWithCallback<T>) => void) =>
    eventTarget.addEventListener(type, listener as EventListener),
  dispatchEvent: (event: Event) => eventTarget.dispatchEvent(event),
};

src.addEventListener("fetch", (event: EventWithCallback<EventTypes["fetch"]>) => {
  logger.info("Received fetch event", event.detail.url);
  fetch(event.detail.url, {
    method: event.detail.method || "GET",
    body: event.detail.body ? JSON.stringify(event.detail.body) : undefined,
  }).then((res) => res.json().then((data) => event.callback({ ok: 1, data })));
});

src.addEventListener("manifest", (event: EventWithCallback<EventTypes["manifest"]>) => {
  logger.info("Received manifest event");
  event.callback({ version: browser.runtime.getManifest().version });
});

src.addEventListener("store", (event: EventWithCallback<EventTypes["store"]>) => {
  logger.info("Received store event", event.detail);
  if (event.detail.value) {
    browser.storage.local.set({ [event.detail.key]: event.detail.value }).then(() =>
      event.callback({
        value: event.detail.value,
      })
    );
  } else {
    browser.storage.local.get(event.detail.key).then((result) =>
      event.callback({
        value: result[event.detail.key],
      })
    );
  }
});

/**
 * Listens for messages from the content script and sends response.
 */
browser.runtime.onMessage.addListener((msg: string, sender) => {
  const message = JSON.parse(msg) as { action: EventAction; payload: unknown };
  logger.info("Received background message", message, "from", sender);
  const senderTabId = sender.tab?.id;
  if (msg && message.action && senderTabId) {
    const ev = new CustomEvent(message.action, {
      detail: message.payload,
    });
    const event = ev as EventWithCallback<EventUntyped>;
    new Promise((resolve) => {
      event.callback = resolve;
      src.dispatchEvent(event);
    }).then((result) => {
      logger.info("Sending response", result, "to", sender);
      browser.tabs.sendMessage(senderTabId, {
        action: message.action + ":response",
        payload: result,
      });
    });
  } else {
    logger.warn("Invalid message", msg, "sender", sender);
  }
});
