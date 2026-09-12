import "dotenv/config";
import express from "express";
import cors from "cors";
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
<<<<<<< HEAD
import policeRouter from "./routes/police.js";
=======
>>>>>>> c2e7849a6003318640d9e7aa82668477f1172799

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" })); // ambient-audio chunks are small but bigger than typical JSON bodies

function mount(path, router) {
  app.use(`/api${path}`, router);
  app.use(path, router);
}

mount("/sos", sosRouter);
mount("/emergency", pingRouter);
mount("/emergency", audioRouter);
mount("/emergency", checklistRouter);
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

export default app;

const PORT = process.env.PORT || 4000;
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Suraksha Shadow API listening on :${PORT}`));
}