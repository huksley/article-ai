import logger from "./logger";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { GlobalStyle } from "./GlobalStyle";

function App() {
  return <GlobalStyle>Here</GlobalStyle>;
}

const element = document.getElementById("react");
if (element) {
  const root = createRoot(element);
  root.render(<App />);
}
