var Buffer = require("buffer/").Buffer;
global.Buffer = Buffer;
/* eslint-disable import/first */
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { BrowserRouter as Router } from "react-router-dom";
import { RecoilRoot } from "recoil";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from '@mui/material/styles';
import { ThemeProvider as MakeStylesProvider } from '@mui/styles';
import theme from "theme";





const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  // <React.StrictMode>
  <RecoilRoot>
    <ThemeProvider theme={theme}>
    <MakeStylesProvider theme={theme}>
      <CssBaseline />
      <Router>
        <App />
      </Router>
    </MakeStylesProvider>
    </ThemeProvider>
  </RecoilRoot>
  // </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
