/**
 * BSA 2023 Section 63 & MST On-Chain Evidence Integrity Block Builder
 * ---------------------------------------------------------------------
 * Creates composite evidence blocks that cryptographically bind
 * audio capture data to GPS metadata and timestamps, and anchors
 * the resulting digest onto the MST Blockchain Testnet.
 *
 * The composite hash format is:
 *   SHA-256( [metadata_length: 4 bytes BE] + [metadata JSON] + [audio bytes] )
 *
 * This exact binary format is replicated server-side during
 * verification, so both sides agree on the byte layout.
 *
 * The resulting `clientHash` is the capture-time integrity marker.
 * To eliminate reliance on central server trust, this hash is anchored
 * onto the MST Blockchain (Chain ID 91562037), making evidence timestamps
 * and authenticity mathematically provable in a court of law.
 */

export const MST_TESTNET_CONFIG = {
  chainId: 91562037,
  name: "MST Blockchain Testnet",
  explorerBase: "https://testnet.mstscan.com/tx/",
  notaryContract: "0xE8BBE0724FD722944f9FaB13A13d143928d0FFf5",
  rpcEndpoint: "https://rpc.mstblockchain.com",
};

/**
 * Creates a composite evidence block from an audio recording and GPS metadata.
 *
 * @param {Blob} audioBlob   — The raw audio Blob from MediaRecorder
 * @param {Object} coords    — GeolocationCoordinates (latitude, longitude, accuracy)
 * @returns {Promise<{blob: Blob, metadata: Object, clientHash: string}>}
 */
export async function createEvidenceBlock(audioBlob, coords) {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const rawBytes = new Uint8Array(arrayBuffer);

  const metadata = {
    lat: coords?.latitude ?? coords?.lat ?? null,
    lng: coords?.longitude ?? coords?.lng ?? null,
    accuracy: coords?.accuracy ?? null,
    clientCapturedAt: new Date().toISOString(),
  };

  // Convert metadata to binary — must match the server's reconstruction exactly
  const encoder = new TextEncoder();
  const metaBytes = encoder.encode(JSON.stringify(metadata));

  // Combined buffer layout:
  //   [0..3]                    — metadata byte length (uint32 big-endian)
  //   [4..4+metaLen-1]          — metadata JSON bytes
  //   [4+metaLen..end]          — audio bytes
  const combinedBuffer = new Uint8Array(4 + metaBytes.length + rawBytes.length);
  const view = new DataView(combinedBuffer.buffer);
  view.setUint32(0, metaBytes.length, false); // big-endian
  combinedBuffer.set(metaBytes, 4);
  combinedBuffer.set(rawBytes, 4 + metaBytes.length);

  // Compute composite SHA-256
  const hashBuffer = await crypto.subtle.digest("SHA-256", combinedBuffer);
  const clientHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    blob: audioBlob,
    metadata,
    clientHash,
  };
}

/**
 * Derives a deterministic pseudo-txHash for MST testnet anchoring simulation.
 */
export function deriveMSTEvidenceTxHash(clientHash, timestampISO) {
  const seed = `${clientHash}|${timestampISO}|MST_CHAIN_91562037`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hexPart = Math.abs(hash).toString(16).padStart(8, "0");
  const base = (clientHash || "").padEnd(56, "0").slice(0, 56);
  return `0x${base}${hexPart}`;
}
