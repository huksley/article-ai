import { Readability } from "@mozilla/readability";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "./invoke";
import { EventTypes } from "./background";
import logger from "./logger";
import { ElementPicker } from "@/src/element-picker/index";

function parse(el?: HTMLElement) {
  let doc: Document | undefined = el ? undefined : (document.cloneNode(true) as Document);
  if (el) {
    console.info("Parsing element", el);
    doc = new DOMParser().parseFromString(el.outerHTML, "text/html");
  }

  if (doc) {
    let reader = new Readability(doc);
    let article = reader.parse();
    console.info("Article", article);
    return article;
  } else {
    return undefined;
  }
}

const getElementSelector = (element: HTMLElement) => {
  const path = [];
  while (element.nodeType === Node.ELEMENT_NODE) {
    let selector = element.nodeName.toLowerCase();
    if (element.id) {
      selector += "#" + element.id;
      path.unshift(selector);
      break;
    } else if (element.className) {
      selector += "." + String(element.className).replace(/ /g, ".");
    } else {
      let sib = element as Element | null | undefined;
      let nth = 1;
      while ((sib = sib?.previousElementSibling)) {
        if (sib.nodeName.toLowerCase() == selector) nth++;
      }
      if (nth != 1) selector += ":nth-of-type(" + nth + ")";
    }
    path.unshift(selector);
    element = element.parentNode as HTMLElement;
  }

  return path.filter((p) => p !== "body" && p !== "html" && !p.startsWith("html.")).join(" > ");
};

/** Copy value to the clipboard */
export const copyValue = (value: string) => {
  const tempInput = document.createElement("input");
  tempInput.setAttribute("style", "position: absolute; left: -1000px; top: -1000px");
  tempInput.value = value;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand("copy");
  logger.info("Copied the text to the clipboard", tempInput.value);
  document.body.removeChild(tempInput);
};

export const App = () => {
  const [content, setContent] = useState("*Empty*");
  const [summary, setSummary] = useState("*Empty*");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [hidden, setHidden] = useState(true);
  const [comment, setComment] = useState("");
  const [element, setElement] = useState<HTMLElement | undefined>();
  const [elementSelector, setElementSelector] = useState<string | undefined>();
  const [pickerRoot, setPickerRoot] = useState<HTMLElement | undefined>();
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    console.log("Starting on page", document);
    invoke<EventTypes["store"]>("store", {
      key: "elementSelector",
    }).then((response) => {
      console.log("Store response", response);
      if (response.value) {
        setElementSelector(response.value as string);
      }
    });
  }, []);

  useEffect(() => {
    if (pickerRoot) {
      const picker = new ElementPicker({
        container: document.body ?? document.documentElement,
        action: {
          trigger: "click",
          hover: (element) => {
            console.log("Element hovered", element);
            setElement(element);
          },
          callback: (element) => {
            console.log("Element picked", element);
            picker.close();
            setPickerRoot(undefined);
          },
        },
      });

      return () => {
        console.log("Closing picker");
        picker.close();
      };
    }

    return () => {};
  }, [pickerRoot]);

  useEffect(() => {
    if (element) {
      const sel = getElementSelector(element);
      setElementSelector(sel);
      invoke<EventTypes["store"]>("store", {
        key: "elementSelector",
        value: sel,
      });
    } else {
      setElementSelector(undefined);
    }
  }, [element]);

  useEffect(() => {
    if (elementSelector) {
      try {
        // Permanently hightlight this element
        const el = document.querySelector(elementSelector) as HTMLElement | null;
        if (el) {
          el.style.outline = "2px solid red";
          el.addEventListener(
            "mouseleave",
            () => {
              el.style.outline = "";
            },
            { once: true }
          );
        }
      } catch (e) {
        console.error("Error highlighting element", e);
      }
    }
  }, [elementSelector]);

  const handleClick = useCallback(() => {
    const c = parse(elementSelector ? (document.querySelector(elementSelector) as HTMLElement | undefined) : element);

    if (c?.content) {
      setContent(c.content);
      setSummary("Parsing article...");
      setKeywords([]);
      invoke<EventTypes["fetch"]>("fetch", {
        url: (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000") + "/api/summary",
        method: "POST",
        body: c,
      }).then((response) => {
        console.log("Summary response", response);
        const res = JSON.parse((response.data as { response: string })?.response) as {
          summary: string;
          keywords: string[];
        };
        //setChatContent(`<b>${res.summary}</b><br><br><br>${res.keywords}`);
        setSummary(res.summary);
        setKeywords(res.keywords);
        setComment("Fetching comment...");
        return invoke<EventTypes["fetch"]>("fetch", {
          url: (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000") + "/api/comment",
          method: "POST",
          body: {
            textContent: res.summary,
          },
        }).then((response) => {
          console.log("Comment response", response);
          setComment(String((response.data as { response: string })?.response));
        });
      });
    }
  }, [elementSelector, element]);

  return (
    <div className="p-4 flex h-[100vh] flex-col gap-4">
      <div className="flex flex-row items-center gap-2">
        <button onClick={handleClick} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          Get article content
        </button>

        <button
          className={
            pickerRoot
              ? "bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              : "bg-blue-400 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          }
          onClick={() => {
            if (pickerRoot) {
              setPickerRoot(undefined);
            } else {
              setPickerRoot(document.body);
            }
          }}
        >
          Pick
        </button>
      </div>

      <div className="flex flex-row justify-between items-center">
        <h1 className="text-l text-blue-900">Article content</h1>
        <a
          href="#"
          className="text-blue-500 hover:text-blue-700 font-bold text-sm"
          onClick={() => {
            setHidden(!hidden);
          }}
        >
          Toggle
        </a>
      </div>

      {!hidden && (
        <div
          className="border p-4 overflow-y-auto text-black"
          style={{ maxHeight: "300px" }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )}

      <h1 className="text-l text-blue-900">Article summary</h1>
      <div className="border p-4 overflow-y-auto text-black" style={{ maxHeight: "300px" }}>
        {summary}
      </div>

      <h1 className="text-l text-blue-900">Keywords</h1>
      <div className="border p-4 overflow-y-auto" style={{ maxHeight: "300px" }}>
        {keywords?.map((k) => (
          <span key={k} className="bg-gray-200 text-black text-sm leading-8 p-1 m-1 rounded">
            {k}
          </span>
        ))}
      </div>

      <div className="flex flex-row justify-between items-center">
        <h1 className="text-l text-blue-900">Comment</h1>
        <a
          href="#"
          className={
            copying
              ? "text-blue-400 hover:text-blue-400 font-bold text-sm"
              : "text-blue-500 hover:text-blue-500 font-bold text-sm"
          }
          onClick={() => {
            setCopying(true);
            copyValue(comment);
            setTimeout(() => {
              setCopying(false);
            }, 300);
          }}
        >
          Copy
        </a>
      </div>
      <div className="border p-4 overflow-y-auto text-black" style={{ maxHeight: "300px" }}>
        {comment}
      </div>
    </div>
  );
};
