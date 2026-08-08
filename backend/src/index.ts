import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { analyzeRouter } from "./routes/analyze.route.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 8787);
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "*";

function log(message: string, details?: unknown): void {
  if (details === undefined) {
    console.log(`[backend] ${message}`);
    return;
  }

  console.log(`[backend] ${message}`, details);
}

function logError(message: string, error: unknown): void {
  console.error(`[backend] ${message}`);
  if (error instanceof Error) {
    console.error(error.stack ?? error.message);
    return;
  }

  console.error(error);
}

process.on("unhandledRejection", (error) => {
  logError("Unhandled rejection", error);
});

process.on("uncaughtException", (error) => {
  logError("Uncaught exception", error);
});

app.use((request, response, next) => {
  const startedAt = Date.now();
  log(`Incoming ${request.method} ${request.originalUrl}`);

  response.on("finish", () => {
    const duration = Date.now() - startedAt;
    log(`Completed ${request.method} ${request.originalUrl} ${response.statusCode} in ${duration}ms`);
  });

  next();
});

app.use(express.json({ limit: "2mb" }));
app.use(
  cors({
    origin: allowedOrigin === "*" ? true : allowedOrigin,
    credentials: false
  })
);

app.get("/health", (_request, response) => {
  log("Health check requested");
  response.json({ ok: true, service: "inboxpilot-backend" });
});

app.use("/api", analyzeRouter);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  logError("Request failed", error);
  response.status(500).json({
    ok: false,
    error: error instanceof Error ? error.message : "Unexpected backend error"
  });
});

app.listen(port, () => {
  log(`InboxPilot backend listening on http://localhost:${port}`);
  log(`Allowed origin: ${allowedOrigin}`);
});