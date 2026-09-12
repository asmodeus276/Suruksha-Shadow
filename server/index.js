import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import sosRouter from "./routes/sos.js";
import pingRouter from "./routes/ping.js";
import fakeCallRouter from "./routes/fakeCall.js";
import contactsRouter from "./routes/contacts.js";
import consentRouter from "./routes/consent.js";
import audioRouter from "./routes/audio.js";
import saharaRouter from "./routes/sahara.js";
import checklistRouter from "./routes/checklist.js";
import smsRouter from "./routes/sms.js";
import checkinRouter from "./routes/checkin.js";
import duressRouter from "./routes/duress.js";
import evidenceRouter from "./routes/evidence.js";
import heartbeatRouter from "./routes/heartbeat.js";
import policeRouter from "./routes/police.js";
import transcribeRouter from "./routes/transcribe.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" })); // allow audio chunks

function mount(routePath, router) {
  app.use(`/api${routePath}`, router);
  app.use(routePath, router);
}

mount("/sos", sosRouter);
mount("/emergency", pingRouter);
mount("/emergency", audioRouter);
mount("/emergency", checklistRouter);
mount("/audio", transcribeRouter);
mount("/fake-call", fakeCallRouter);
mount("/contacts", contactsRouter);
mount("/consent", consentRouter);
mount("/sahara", saharaRouter);
mount("/emergency-sms", smsRouter);
mount("/checkin", checkinRouter);
mount("/security", duressRouter);
mount("/evidence", evidenceRouter);
mount("/heartbeat", heartbeatRouter);
mount("/police", policeRouter);

app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/api/health", (req, res) => res.json({ ok: true }));

const clientDist = path.resolve(__dirname, "../client/dist");

app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    const indexHtml = path.join(clientDist, "index.html");
    if (fs.existsSync(indexHtml)) {
      return res.sendFile(indexHtml);
    }
  }
  next();
});

export default app;

const PORT = process.env.PORT || 4000;
if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Suraksha Shadow running on http://0.0.0.0:${PORT}`);
  });
}