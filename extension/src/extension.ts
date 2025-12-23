// PRAGMA: keep-js, standalone
"use strict";

import { createRoot } from "react-dom/client";
import logger from "./logger";
import { UI } from "./UI";
import { assignInnerHTML, createRootElement } from "./util";
import browser from "webextension-polyfill";
import { EventAction, EventTypes } from "./background";
import { invoke } from "./invoke";
import { Storage } from "./Storage";

const createExtensionPane = (width: number, id: string, visible?: boolean) => {
  const root = createRootElement(document, id);
  root.setAttribute("data-extension-managed", "extension");
  root.style.position = "fixed";
  root.style.top = "0px";
  root.style.bottom = "0px";
  root.style.right = "0px";
  root.style.width = width + "px";
  root.style.backgroundColor = "#fff";
  root.style.padding = "0px";
  root.style.overflowY = "auto";
  root.style.zIndex = "1000";
  root.style.display = visible ? "" : "none";
  if (visible && document.body) {
    document.body.style.marginRight = width + "px";
  }
  return Promise.resolve(root);
};

function createBadge() {
  const badge = createRootElement(document, "__extension_badge");
  badge.setAttribute("data-extension-managed", "badge");
  badge.style.position = "fixed";
  badge.style.bottom = "180px";
  badge.style.fontFamily = "Inter, sans-serif";
  badge.style.fontSize = "13px";
  badge.style.overflow = "hidden";
  badge.style.right = "0px";
  badge.style.height = "22px";
  badge.style.transform = "rotate(-90deg) translateZ(0)";
  badge.style.transformOrigin = "100% 100%";
  badge.style.padding = "4px 12px 4px 12px";
  badge.style.cursor = "pointer";
  badge.style.border = "2px solid #EE0000";
  badge.style.borderBottom = "0px";
  badge.style.borderRadius = "4px 4px 0px 0px";
  badge.style.color = "#fff";
  badge.style.backgroundColor = "#DD0000";
  badge.style.zIndex = "1000";
  badge.style.userSelect = "none";
  assignInnerHTML(badge, "🧐 Augmented AI");
  return Promise.resolve(badge);
}

const store = new Storage();

createExtensionPane(300, "--article-ai", store.getBool("visible", false))
  .then((root) => {
    createBadge()
      .then((badge) => {
        try {
          new UI().start(root, badge, store);
        } catch (e) {
          logger.error("Failed to start UI", e);
        }
      })
      .catch((e) => logger.error("Failed to create badge", e));
  })
  .catch((e) => logger.error("Failed to create extension pane", e));
