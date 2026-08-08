import React from "react";
import { createRoot } from "react-dom/client";
import { Popup } from "./Popup";
import "../sidebar/styles.css";

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);