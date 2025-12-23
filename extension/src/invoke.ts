// PRAGMA: keep-js, standalone
"use strict";
import logger from "./logger";
import { EventUntyped } from "./background";

/** Send message to the background script and receives response */

export const invoke = <T extends EventUntyped>(action: T["type"], detail?: T["request"]): Promise<T["response"]> => {
  try {
    const wrapper = new CustomEvent("sendBackgroundMessage", {
      detail: JSON.stringify({
        action,
        payload: detail,
      }),
    });
    logger.info("Sending event", wrapper);
    const start = Date.now();
    document.dispatchEvent(wrapper);

    return new Promise((resolve) => {
      const listener = function (event: Event) {
        const response = JSON.parse((event as CustomEvent).detail) as {
          action: string;
          payload: T["response"];
        };
        if (response.action === action + ":response") {
          logger.info("Received response", response.payload);
          document.removeEventListener("receiveBackgroundMessage", listener);
          resolve(response.payload);
        }
      };
      document.addEventListener("receiveBackgroundMessage", listener);
    });
  } catch (e) {
    logger.error("Failed to invoke", e);
    return Promise.reject(e);
  }
};
