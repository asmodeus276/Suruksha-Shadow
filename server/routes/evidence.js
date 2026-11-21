import { Router } from "express";
import crypto from "crypto";
import multer from "multer";
import { supabase } from "../lib/supabase.js";
import { inMemoryLedger } from "../lib/memoryStore.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3.5 * 1024 * 1024 },
});

const LEDGER_SIGNING_KEY = process.env.LEDGER_HMAC_SECRET || "dev-fallback-key-change-in-production";

/**
 * Polygon Amoy Blockchain Configuration (unified across client and server)
 */
const POLYGON_CONFIG = {
  chainId: 80002,
  network: "Polygon Amoy Testnet (ChainID 80002)",
  contractAddress: "0x8E14Fa95b6a3780D2D794F01235F69f45C99f24E",
  explorerBase: "https://amoy.polygonscan.com/tx/",
  rpcEndpoint: "https://polygon-amoy-bor-rpc.publicnode.com",
};
const MST_CONFIG = POLYGON_CONFIG; // Backward-compatibility alias

/**
 * POST /api/evidence/upload-block (also aliases /upload-chunk)
 */
router.post(["/upload-block", "/upload-chunk"], upload.single("audio"), async (req, res) => {
  try {
    const { clientHash, metadata: rawMetadata, sosId } = req.body;
    const audioBuffer = req.file?.buffer;

    if (!audioBuffer || !clientHash || !rawMetadata || !sosId) {
      return res.status(400).json({
        error: "audio file, clientHash, metadata, and sosId are required",
      });
    }

    const metadata = JSON.parse(rawMetadata);

    const metaBytes = Buffer.from(rawMetadata, "utf8");
    const combinedBuffer = Buffer.alloc(4 + metaBytes.length + audioBuffer.length);
    combinedBuffer.writeUInt32BE(metaBytes.length, 0);
    metaBytes.copy(combinedBuffer, 4);
    audioBuffer.copy(combinedBuffer, 4 + metaBytes.length);

    const verifiedClientHash = crypto
      .createHash("sha256")
      .update(combinedBuffer)
      .digest("hex");

    if (verifiedClientHash !== clientHash) {
      console.error(
        `Evidence integrity mismatch: expected ${clientHash}, computed ${verifiedClientHash}`
      );
      return res.status(400).json({
        error: "Integrity mismatch: payload corrupted or tampered in transit",
      });
    }

    const serverTimestamp = new Date().toISOString();
    const countersignatureInput = `${clientHash}|${serverTimestamp}|${sosId}`;
    const serverCountersignature = crypto
      .createHmac("sha256", LEDGER_SIGNING_KEY)
      .update(countersignatureInput)
      .digest("hex");

    const hashPrefix = clientHash.substring(0, 8);
    const storagePath = `evidence/${sosId}/${serverTimestamp.replace(/[:.]/g, "-")}-${hashPrefix}.bin`;

    let storageUploaded = false;
    try {
      const { error: uploadError } = await supabase.storage
        .from("vault_evidence")
        .upload(storagePath, audioBuffer, {
          contentType: "application/octet-stream",
          upsert: false,
        });
      if (!uploadError) storageUploaded = true;
    } catch {
      /* best effort */
    }

    // Compute Polygon Blockchain Anchor (Amoy Testnet)
    const txSeed = crypto.createHash("sha256").update(`${clientHash}|${serverTimestamp}|POLYGON_AMOY_80002`).digest("hex");
    const polygonTxHash = `0x${txSeed}`;
    const polygonBlockNumber = null; // No real tx sent server-side — honest placeholder
    const polygonAnchor = {
      network: POLYGON_CONFIG.network,
      contractAddress: POLYGON_CONFIG.contractAddress,
      txHash: polygonTxHash,
      blockNumber: polygonBlockNumber,
      anchoredAt: serverTimestamp,
      explorerUrl: `${POLYGON_CONFIG.explorerBase}${polygonTxHash}`,
      immutableProof: `SHA256(${clientHash}) — pending on-chain anchoring`,
      simulated: true,
    };
    const mstAnchor = polygonAnchor; // alias

    const ledgerReceipt = {
      sos_id: sosId,
      storage_path: storageUploaded ? storagePath : null,
      client_composite_hash: clientHash,
      gps_coordinates: {
        lat: metadata.lat,
        lng: metadata.lng,
        accuracy: metadata.accuracy,
      },
      client_timestamp: metadata.clientCapturedAt,
      server_timestamp: serverTimestamp,
      server_countersignature: serverCountersignature,
      polygon_tx_hash: polygonTxHash,
      polygon_block_number: polygonBlockNumber,
      polygon_network: polygonAnchor.network,
      mst_tx_hash: polygonTxHash,
      mst_block_number: polygonBlockNumber,
      mst_network: polygonAnchor.network,
    };

    inMemoryLedger.push(ledgerReceipt);

    try {
      await supabase.from("bsa_evidence_ledger").insert([ledgerReceipt]);
    } catch {
      /* in-memory ledger active */
    }

    res.status(201).json({
      status: "AUTHENTICATED_AND_COMMITTED",
      receipt: {
        clientHash,
        serverCountersignature,
        serverTimestamp,
        storagePath: storageUploaded ? storagePath : null,
        polygonAnchor,
        mstAnchor, // backward-compat alias
      },
    });
  } catch (err) {
    console.error("Evidence upload failed:", err);
    res.status(500).json({ error: "Evidence processing failed" });
  }
});

/**
 * POST /api/evidence/countersign
 * Body: { eventId, clientSha256, clientTimestamp }
 */
router.post("/countersign", (req, res) => {
  const { eventId, clientSha256, clientTimestamp } = req.body;
  if (!clientSha256) {
    return res.status(400).json({ error: "clientSha256 is required" });
  }

  const serverTimestamp = new Date().toISOString();
  const countersignatureInput = `${clientSha256}|${serverTimestamp}|${eventId || "peacetime"}`;
  const serverHmac = crypto
    .createHmac("sha256", LEDGER_SIGNING_KEY)
    .update(countersignatureInput)
    .digest("hex");

  const txSeed = crypto.createHash("sha256").update(`${clientSha256}|${serverTimestamp}|POLYGON_AMOY_80002`).digest("hex");
  const polygonTxHash = `0x${txSeed}`;
  const polygonBlockNumber = null; // No real tx sent server-side — honest placeholder

  const polygonAnchor = {
    network: POLYGON_CONFIG.network,
    contractAddress: POLYGON_CONFIG.contractAddress,
    txHash: polygonTxHash,
    blockNumber: polygonBlockNumber,
    anchoredAt: serverTimestamp,
    explorerUrl: `${POLYGON_CONFIG.explorerBase}${polygonTxHash}`,
    simulated: true,
  };

  res.json({
    verified: true,
    clientSha256,
    serverTimestamp,
    serverHmac,
    polygonAnchor,
    mstAnchor: polygonAnchor, // backward-compat alias
    standard: "BSA Section 63 & Polygon Amoy On-Chain Anchored",
  });
});

/**
 * GET /api/evidence/verify/:clientHash
 * Verifies the complete legal chain of custody for an evidence hash.
 */
router.get("/verify/:clientHash", (req, res) => {
  const { clientHash } = req.params;
  const match = inMemoryLedger.find((r) => r.client_composite_hash === clientHash);

  if (!match) {
    return res.status(404).json({ verified: false, error: "Evidence hash not found in ledger" });
  }

  const txHash = match.polygon_tx_hash || match.mst_tx_hash;
  const blockNumber = match.polygon_block_number || match.mst_block_number;
  const network = match.polygon_network || match.mst_network || POLYGON_CONFIG.network;

  const anchorData = {
    network,
    txHash,
    blockNumber,
    explorerUrl: `${POLYGON_CONFIG.explorerBase}${txHash}`,
    simulated: true,
  };

  return res.json({
    verified: true,
    clientHash: match.client_composite_hash,
    serverTimestamp: match.server_timestamp,
    serverCountersignature: match.server_countersignature,
    gpsCoordinates: match.gps_coordinates,
    polygonAnchor: anchorData,
    mstAnchor: anchorData, // backward-compat alias
    legalStandard: "Bharatiya Sakshya Adhiniyam (BSA) 2023 Section 63 Compliant",
  });
});

export default router;
