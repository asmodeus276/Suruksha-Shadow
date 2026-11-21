/**
 * BSA 2023 Section 63 & Polygon On-Chain Evidence Integrity Block Builder
 * ---------------------------------------------------------------------
 * Creates composite evidence blocks that cryptographically bind
 * audio capture data to GPS metadata and timestamps, and anchors
 * the resulting digest onto Polygon Amoy Testnet.
 *
 * The composite hash format is:
 *   SHA-256( [metadata_length: 4 bytes BE] + [metadata JSON] + [audio bytes] )
 *
 * This exact binary format is replicated server-side during
 * verification, so both sides agree on the byte layout.
 *
 * The resulting `clientHash` is the capture-time integrity marker.
 * To eliminate reliance on central server trust, this hash is anchored
 * onto Polygon Amoy (Chain ID 80002), making evidence timestamps
 * and authenticity mathematically provable in a court of law.
 */

export const POLYGON_AMOY_CONFIG = {
  chainId: 80002,
  name: "Polygon Amoy Testnet",
  explorerBase: "https://amoy.polygonscan.com/tx/",
  notaryContract: "0x93838ab7dae0698561e96e95a8243c81710980c604a132b34e4287914178c4bb",
  rpcEndpoint: "https://polygon-amoy-bor-rpc.publicnode.com",
};

export const MST_TESTNET_CONFIG = POLYGON_AMOY_CONFIG; // Backward-compatibility alias

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
