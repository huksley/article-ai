import logger from "./logger";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { GlobalStyle } from "./GlobalStyle";

function App() {
  return <GlobalStyle>
    <h1 className="text-white">Extension installed</h1>
  </GlobalStyle>;
}

const element = document.getElementById("react");
if (element) {
  const root = createRoot(element);
  root.render(<App />);
}
