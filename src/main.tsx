import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles/app.css";
import "./styles/base.css";
import "./i18n";
import App from "./App";
import { AppThemeProvider } from "./theme";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <BrowserRouter>
            <AppThemeProvider>
                <App />
            </AppThemeProvider>
        </BrowserRouter>
    </React.StrictMode>,
);
