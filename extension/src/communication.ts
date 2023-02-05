import logger from "./logger";

/**
 * Send message to background script without waiting for reponse.
 */
export const sendMessage = (action: string, data?: Record<string, unknown>) => {
  logger.verbose("Sending message", action);
  document.dispatchEvent(
    new CustomEvent("extensionSendBackgroundMessage", {
      detail: JSON.stringify({ action, ...data }),
    })
  );
};

/** Send message to background script and wait for response */
export const sendCall = <T>(action: string, data?: Record<string, unknown>) => {
  logger.verbose("Sending message call", action);
  document.dispatchEvent(
    new CustomEvent("extensionSendBackgroundMessage", {
      detail: JSON.stringify({ action, ...data }),
    })
  );

  return receiveMessage(action) as Promise<T>;
};

/**
 * Receive async response from background
 */
export const receiveMessage = (action: string): Promise<Record<string, unknown>> => {
  return new Promise((resolve) => {
    const listener = function (event: Event) {
      if (event instanceof CustomEvent && typeof event.detail === "string") {
        const json = JSON.parse(event.detail as string);
        if (json && json.action && json.action === action + ":response") {
          logger.verbose("Got response for call", json);
          resolve(json);
          document.removeEventListener("extensionReceiveBackgroundMessage", listener);
        }
      } else {
        logger.warn("Invalid event", event);
      }
    };

    document.addEventListener("extensionReceiveBackgroundMessage", listener);
  });
};
