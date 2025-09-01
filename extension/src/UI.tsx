import { Readability } from "@mozilla/readability";
import logger from "./logger";
import { createReactRoot } from "./util";
import { App } from "./App";
import { GlobalStyle } from "./GlobalStyle";
import React from "react";
import { Storage } from "./Storage";
import { ElementPicker } from "@/src/element-picker/index";

export class UI {
  constructor() {}

  parse() {
    const doc = document.cloneNode(true);
    let reader = new Readability(doc as Document);
    let article = reader.parse();
    logger.info("Article", article);
    return article;
  }

  start(element: HTMLDivElement, badge: HTMLDivElement, store: Storage) {
    badge.addEventListener("click", () => {
      if (element.style.display === "none") {
        store.set("visible", true);
        const width = parseInt(element.style.width, 10);
        document.body.style.marginRight = width + "px";
        element.style.display = "";
      } else {
        store.set("visible", false);
        document.body.style.marginRight = "0px";
        element.style.display = "none";
      }
    });

    const root = createReactRoot(element);
    root.render(
      <GlobalStyle
        style={{
          height: "100vh",
        }}
      >
        <App />
      </GlobalStyle>
    );

    const style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("id", "__external-font");
    document.head.appendChild(style);
    // Sheet is only available after style is added to document
    setTimeout(() => {
      style.sheet?.insertRule(
        '@import url("https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600;1,700&display=swap")'
      );
    });
  }
}
