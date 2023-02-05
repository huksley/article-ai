import logger from "../../lib/logger";
import { RecipientChange } from "./GMailJSExtensionStrategy";
import { unmountComponentAtNode } from "react-dom";
import { parseAddress } from "@/lib/util";

export function findElement(root: Node, xpath: string) {
  let e: Element | null = null;
  try {
    e = document.evaluate(xpath, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
      .singleNodeValue as Element;
    return e;
  } catch (error) {
    logger.warn("Failed to find expression", error.message, error);
  }
  return e;
}

/**
 * Creates element, or if it exists, removes all childs.
 * Attaches it to body or to specified element
 */
export const createRootElement = (document: Document, id: string, prepend?: Element) => {
  let e = document.getElementById(id) as HTMLDivElement;
  if (!e) {
    logger.info("Creating div", id);
    e = document.createElement("div");
    e.setAttribute("id", id);
    e.id = id;

    if (prepend) {
      prepend.prepend(e);
    } else {
      document.body.appendChild(e);
    }
  } else {
    /** If two copies of extension are working, this can cause errors */
    try {
      unmountComponentAtNode(e);
    } catch (e) {
      // Do not care
    }

    Array.from(e.childNodes).forEach(ch => {
      try {
        e.removeChild(ch);
      } catch (e) {
        // Do not care
      }
    });
  }
  return e;
};

export async function waitForSelector(root: HTMLElement, query: string, ms?: number) {
  root = root || document;
  ms = ms || 10000;
  let e: Element | undefined = undefined;
  try {
    e = root.querySelector(query) || undefined;
    const startTime = Date.now();
    while (e === undefined) {
      await new Promise(resolve => setTimeout(resolve, 100));
      e = root.querySelector(query) || undefined;
      if (e === undefined && Date.now() - startTime > ms) {
        logger.warn("Timed out trying to find query selector", query);
        return undefined;
      }
    }
  } catch (error) {
    logger.warn("Failed to find query selector", query, error.message, error);
  }
  logger.verbose("Found", query, e);
  return e;
}

export async function waitForSelectorAll(root: HTMLElement, query: string, ms?: number) {
  root = root || document;
  ms = ms || 10000;
  let l: Element[] = [];
  try {
    l = Array.from(root.querySelectorAll(query));
    const startTime = Date.now();
    while (l.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
      l = Array.from(root.querySelectorAll(query));
      if (l.length === 0 && Date.now() - startTime > ms) {
        logger.warn("Timed out trying to find query selector", query, Date.now() - startTime);
        return undefined;
      }
    }
  } catch (error) {
    logger.warn("Failed to find query selector", query, error.message, error);
    return undefined;
  }
  logger.verbose("Found", query, l);
  return l;
}

export async function waitForElement(root: Node, xpath: string, seconds?: number) {
  root = root || document;
  seconds = seconds || 10;
  let e: Element | undefined = undefined;
  try {
    e = document.evaluate(xpath, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
      .singleNodeValue as Element;
    const startTime = new Date().getTime();
    while (e === null) {
      await new Promise(resolve => setTimeout(resolve, 100));
      e = document.evaluate(xpath, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
        .singleNodeValue as Element;
      if (e === null && new Date().getTime() - startTime > seconds * 1000) {
        logger.warn("Failed to find", xpath);
        return undefined;
      }
    }
  } catch (error) {
    logger.warn("Failed to find expression", xpath, error.message, error);
  }
  logger.verbose("Found", xpath, e);
  return e;
}

export async function waitForElements(root: Node, xpath: string, seconds?: number) {
  root = root || document;
  seconds = seconds || 10;
  let e = null;
  try {
    e = document.evaluate(
      xpath,
      root,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
    const startTime = new Date().getTime();
    while (e === null) {
      await new Promise(resolve => setTimeout(resolve, 100));
      e = document.evaluate(
        xpath,
        root,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
      if (e === null && new Date().getTime() - startTime > seconds * 1000) {
        logger.warn("Failed to find", xpath);
        return [];
      }
    }
  } catch (error) {
    logger.warn("Failed to find expression", error.message, error);
  }

  logger.verbose("Found", xpath, "first element", e);
  const snapshot = document.evaluate(
    xpath,
    root,
    null,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );
  const result = [];
  for (let i = 0; i < snapshot.snapshotLength; i++) {
    result.push(snapshot.snapshotItem(i));
  }
  logger.verbose("Found", xpath, "results", result.length);
  return result as HTMLElement[];
}

/**
 * Return element by id
 */
export const el = (id: string) => {
  const e = document.getElementById(id);
  if (!e) {
    logger.warn("Cannot find element", id);
  }
  return e as HTMLInputElement | HTMLElement;
};

/**
 * Return form element value or innerHTML
 */
export const elv = (id: string) => {
  const e = el(id);
  if (e instanceof HTMLInputElement && e.value !== undefined) {
    return e.value;
  } else if (e) {
    return e.innerHTML;
  } else {
    return e;
  }
};

export type DispatchEventType = "input" | "focus" | "tab" | "enter" | "click";

export const dispatchEvent = (
  events: DispatchEventType[] | DispatchEventType,
  element: HTMLElement
) => {
  events = Array.isArray(events) ? events : [events];

  events.forEach(event => {
    if (event === "click") {
      element.click();
    } else if (event === "input") {
      const event = new Event("input", { bubbles: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (event as any).simulated = true;
      // hack React16 https://github.com/facebook/react/issues/11488
      // see https://github.com/facebook/react/blob/main/packages/react-dom/src/client/inputValueTracking.js
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tracker = (element as any)._valueTracker;
      if (tracker) {
        const lastValue = "";
        tracker.setValue(lastValue);
      } else {
        // Probably fine for Gmail as it does not use React
        logger.verbose("No React16 _valueTracker to simulate input event for", element);
      }
      element.dispatchEvent(event);
    } else if (event === "focus") {
      element.focus();
      const keyboardEvent = new KeyboardEvent("focus", {
        bubbles: true
      });
      element.dispatchEvent(keyboardEvent);
    } else if (event === "tab") {
      const keyboardEvent = new KeyboardEvent("keydown", {
        code: "Tab",
        key: "Tab",
        keyCode: 9,
        view: window,
        bubbles: true
      });
      element.dispatchEvent(keyboardEvent);
    } else if (event === "enter") {
      const keyboardEvent = new KeyboardEvent("keydown", {
        code: "Enter",
        key: "Enter",
        keyCode: 13,
        view: window,
        bubbles: true
      });
      element.dispatchEvent(keyboardEvent);
    } else {
      logger.warn("Unknown event: ", event);
    }
  });
};

export const parseEventRecipient = (event: RecipientChange) => {
  return event.recipients.to
    .map(a => a.address)
    .map(parseAddress)
    .join(",");
};

export const isVisible = (e: HTMLElement) => {
  return !!e.offsetParent;
};
