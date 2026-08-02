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

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" })); // ambient-audio chunks are small but bigger than typical JSON bodies

app.use("/api/sos", sosRouter);
app.use("/api/emergency", pingRouter);
app.use("/api/emergency", audioRouter);
app.use("/api/emergency", checklistRouter);
app.use("/api/fake-call", fakeCallRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/consent", consentRouter);
app.use("/api/sahara", saharaRouter);

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Suraksha Shadow API listening on :${PORT}`));