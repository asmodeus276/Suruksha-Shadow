import { useEffect, useRef, useState, useCallback } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import {
  GestureDescription,
  Finger,
  FingerCurl,
  GestureEstimator,
} from "fingerpose";

/**
 * ============================================================================
 * SIGNAL FOR HELP (Canadian Women's Foundation / Distress Hand Signal)
 * ============================================================================
 * Internationally recognized single-handed distress signal:
 * 1. Palm facing camera.
 * 2. Thumb tucked into palm across the base of fingers.
 * 3. Four fingers (Index, Middle, Ring, Pinky) folded down over the thumb,
 *    effectively trapping the thumb in a closed fist.
 *
 * This gesture allows someone on a video call, in a vehicle, or in an unsafe
 * situation to discreetly signal for emergency assistance without making a sound.
 * ============================================================================
 */

// Configure rule-based GestureDescription for the trapped-thumb fist position.
const signalForHelpGesture = new GestureDescription("signal_for_help");

// Thumb: curled and tucked across the palm
signalForHelpGesture.addCurl(Finger.Thumb, FingerCurl.FullCurl, 1.0);
signalForHelpGesture.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 0.9);

// Four fingers (Index, Middle, Ring, Pinky) folded over the tucked thumb
for (const finger of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  signalForHelpGesture.addCurl(finger, FingerCurl.FullCurl, 1.0);
  signalForHelpGesture.addCurl(finger, FingerCurl.HalfCurl, 0.85);
}

const GESTURE_ESTIMATOR = new GestureEstimator([signalForHelpGesture]);

/**
 * 3D Geometric Invariant check for the Signal for Help.
 * Works seamlessly across left and right hands, varying hand sizes,
 * camera angles, and partial occlusions.
 */
function checkDistressGeometry(landmarks) {
  if (!landmarks || landmarks.length < 21) return { isDistress: false, thumbTucked: false, curledCount: 0 };

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexMcp = landmarks[5];
  const indexPip = landmarks[6];
  const indexTip = landmarks[8];
  const middleMcp = landmarks[9];
  const middlePip = landmarks[10];
  const middleTip = landmarks[12];
  const ringMcp = landmarks[13];
  const ringPip = landmarks[14];
  const ringTip = landmarks[16];
  const pinkyMcp = landmarks[17];
  const pinkyPip = landmarks[18];
  const pinkyTip = landmarks[20];

  const dist = (p1, p2) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = (p1.z || 0) - (p2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  // Reference palm scale (distance between index MCP and pinky MCP, or wrist to middle MCP)
  const palmWidth = Math.max(dist(indexMcp, pinkyMcp), 0.05);
  const palmHeight = Math.max(dist(wrist, middleMcp), 0.05);
  const palmScale = (palmWidth + palmHeight) / 2;

  const palmCenter = {
    x: (wrist.x + indexMcp.x + pinkyMcp.x) / 3,
    y: (wrist.y + indexMcp.y + pinkyMcp.y) / 3,
    z: ((wrist.z || 0) + (indexMcp.z || 0) + (pinkyMcp.z || 0)) / 3,
  };

  // Check finger curls (tips folded towards palm center or MCP base)
  const isCurled = (tip, pip, mcp) => {
    return (
      dist(tip, mcp) < palmScale * 0.95 ||
      dist(tip, palmCenter) < palmScale * 0.85 ||
      dist(tip, wrist) < dist(pip, wrist) * 1.15
    );
  };

  const indexCurled = isCurled(indexTip, indexPip, indexMcp);
  const middleCurled = isCurled(middleTip, middlePip, middleMcp);
  const ringCurled = isCurled(ringTip, ringPip, ringMcp);
  const pinkyCurled = isCurled(pinkyTip, pinkyPip, pinkyMcp);

  const curledCount = [indexCurled, middleCurled, ringCurled, pinkyCurled].filter(Boolean).length;

  // Thumb tucked: thumb tip folded across palm towards center, middle, or pinky base
  const thumbTucked =
    dist(thumbTip, palmCenter) < palmScale * 1.2 ||
    dist(thumbTip, middleMcp) < palmScale * 1.15 ||
    dist(thumbTip, ringMcp) < palmScale * 1.3 ||
    dist(thumbTip, pinkyMcp) < palmScale * 1.45;

  const isDistress = (curledCount >= 3 && thumbTucked) || (curledCount === 4);

  return { isDistress, thumbTucked, curledCount };
}

// Global cached instances to avoid duplicate WASM / model downloads
let cachedHandLandmarker = null;
let landmarkerLoadingPromise = null;

async function getHandLandmarker() {
  if (cachedHandLandmarker) return cachedHandLandmarker;
  if (landmarkerLoadingPromise) return landmarkerLoadingPromise;

  landmarkerLoadingPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    // Try GPU acceleration first; fall back to CPU if WebGL is unavailable
    try {
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });
      cachedHandLandmarker = landmarker;
      return landmarker;
    } catch (gpuErr) {
      console.warn("MediaPipe GPU delegate unavailable, falling back to CPU:", gpuErr);
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });
      cachedHandLandmarker = landmarker;
      return landmarker;
    }
  })();

  return landmarkerLoadingPromise;
}

const FRAME_THROTTLE_MS = 75; // ~13-14 FPS: optimal balance between smooth tracking and CPU efficiency
const DEFAULT_HOLD_DURATION_MS = 1200; // 1.2s sustained hold: snappy, accessible, yet debounced
const OCCLUSION_GRACE_PERIOD_MS = 450; // Tolerates momentary dropped frames during hold

/**
 * useGestureDetection
 *
 * Client-side silent emergency trigger detecting the "Signal for Help".
 * Camera is strictly OFF by default and runs only when explicitly activated.
 */
export function useGestureDetection({
  _enabled = true,
  onTrigger,
  holdDurationMs = DEFAULT_HOLD_DURATION_MS,
}) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | watching | detected | error | unsupported
  const [lastError, setLastError] = useState(null);
  const [gestureProgress, setGestureProgress] = useState(0); // 0.0 to 1.0
  const [handDetected, setHandDetected] = useState(false);
  const [gestureMatched, setGestureMatched] = useState(false);
  const [diagnosticInfo, setDiagnosticInfo] = useState("Camera off");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const lastProcessedTimeRef = useRef(0);
  const lastMatchTimeRef = useRef(0);
  const holdStartTimeRef = useRef(null);
  const triggeredRef = useRef(false);

  const fire = useCallback(
    (type = "gesture") => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;
      setStatus("detected");
      setDiagnosticInfo("Distress signal triggered! Dispatching SOS...");
      onTrigger?.(type);
    },
    [onTrigger]
  );

  // Stop camera tracks and release hardware
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          /* ignore */
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    holdStartTimeRef.current = null;
    lastMatchTimeRef.current = 0;
    setGestureProgress(0);
    setHandDetected(false);
    setGestureMatched(false);
    setIsCameraActive(false);
    setStatus("idle");
    setDiagnosticInfo("Camera off");
  }, []);

  // Request camera stream and start HandLandmarker loop
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setLastError("Camera not supported on this device/browser");
      setDiagnosticInfo("Camera unsupported");
      return;
    }

    try {
      setStatus("loading");
      setLastError(null);
      setDiagnosticInfo("Initializing camera & AI models...");

      // Load or retrieve cached MediaPipe HandLandmarker
      const landmarker = await getHandLandmarker();

      // Request front-facing camera with fallback
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error("Video element ref not attached");
      }

      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.muted = true;

      await new Promise((resolve) => {
        if (video.readyState >= 2) {
          video.play().then(resolve).catch(resolve);
        } else {
          video.onloadedmetadata = () => {
            video.play().then(resolve).catch(resolve);
          };
        }
      });

      setIsCameraActive(true);
      setStatus("watching");
      setDiagnosticInfo("Watching for Signal for Help...");

      // Frame detection loop with battery-saving frame throttling
      const processFrame = () => {
        if (!streamRef.current || !videoRef.current) return;

        const now = performance.now();
        if (now - lastProcessedTimeRef.current >= FRAME_THROTTLE_MS) {
          lastProcessedTimeRef.current = now;

          if (
            video.readyState >= 2 &&
            !video.paused &&
            !video.ended &&
            video.videoWidth > 0 &&
            video.videoHeight > 0
          ) {
            try {
              const results = landmarker.detectForVideo(video, now);
              const wallNow = Date.now();
              let matched = false;

              if (results.landmarks && results.landmarks.length > 0) {
                setHandDetected(true);
                const rawLandmarks = results.landmarks[0];

                // 1. Direct 3D geometry check
                const { isDistress: geomMatch, thumbTucked, curledCount } = checkDistressGeometry(rawLandmarks);

                // 2. Rule-based fingerpose check
                const handLandmarks = rawLandmarks.map((pt) => [
                  pt.x * (video.videoWidth || 640),
                  pt.y * (video.videoHeight || 480),
                  (pt.z || 0) * (video.videoWidth || 640),
                ]);

                let fpMatch = false;
                try {
                  const estimation = GESTURE_ESTIMATOR.estimate(handLandmarks, 5.0);
                  const found = estimation.gestures.find(
                    (g) => g.name === "signal_for_help" && g.score >= 5.0
                  );
                  if (found) fpMatch = true;
                } catch {
                  /* ignore fingerpose internal errors */
                }

                // Either direct geometry OR fingerpose qualifies the gesture
                matched = geomMatch || fpMatch;

                if (matched && !triggeredRef.current) {
                  setGestureMatched(true);
                  lastMatchTimeRef.current = wallNow;

                  if (!holdStartTimeRef.current) {
                    holdStartTimeRef.current = wallNow;
                  }
                  const elapsed = wallNow - holdStartTimeRef.current;
                  const prog = Math.min(1, elapsed / holdDurationMs);
                  setGestureProgress(prog);
                  setDiagnosticInfo(
                    `Holding distress signal: ${Math.round(prog * 100)}%`
                  );

                  if (elapsed >= holdDurationMs) {
                    fire("gesture");
                  }
                } else if (!triggeredRef.current) {
                  setGestureMatched(false);
                }

                // Real-time helpful guidance if not yet full match
                if (!matched && !triggeredRef.current && !holdStartTimeRef.current) {
                  if (!thumbTucked) {
                    setDiagnosticInfo("Hand tracked — tuck thumb into palm");
                  } else if (curledCount < 3) {
                    setDiagnosticInfo("Thumb tucked — fold 4 fingers over thumb");
                  } else {
                    setDiagnosticInfo("Fold fingers over thumb to trigger signal");
                  }
                }
              } else {
                setHandDetected(false);
                setGestureMatched(false);
              }

              if (!matched && !triggeredRef.current) {
                // Check if within the momentary occlusion grace period
                if (
                  holdStartTimeRef.current &&
                  wallNow - lastMatchTimeRef.current < OCCLUSION_GRACE_PERIOD_MS
                ) {
                  // Maintain hold progress during momentary dropped frames
                } else {
                  // Sustained loss of gesture — reset hold progress
                  holdStartTimeRef.current = null;
                  setGestureProgress(0);
                  if (!results.landmarks || results.landmarks.length === 0) {
                    setDiagnosticInfo("Watching for hand in camera view...");
                  }
                }
              }
            } catch (err) {
              console.warn("Hand landmarker frame error:", err);
            }
          }
        }

        animFrameIdRef.current = requestAnimationFrame(processFrame);
      };

      animFrameIdRef.current = requestAnimationFrame(processFrame);
    } catch (err) {
      console.warn("Camera Watch start failed:", err);
      stopCamera();
      setStatus("error");
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setLastError("Camera permission denied");
        setDiagnosticInfo("Camera permission denied");
      } else {
        setLastError(err.message || "Failed to initialize camera watch");
        setDiagnosticInfo(err.message || "Failed to initialize camera watch");
      }
    }
  }, [fire, holdDurationMs, stopCamera]);

  // Toggle Camera Watch ON/OFF
  const toggleCameraWatch = useCallback(() => {
    if (isCameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  }, [isCameraActive, startCamera, stopCamera]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const reset = useCallback(() => {
    triggeredRef.current = false;
    holdStartTimeRef.current = null;
    lastMatchTimeRef.current = 0;
    setGestureProgress(0);
    setHandDetected(false);
    setGestureMatched(false);
    if (isCameraActive) {
      setStatus("watching");
      setDiagnosticInfo("Watching for Signal for Help...");
    }
  }, [isCameraActive]);

  return {
    status,
    isCameraActive,
    gestureProgress,
    handDetected,
    gestureMatched,
    diagnosticInfo,
    lastError,
    videoRef,
    startCamera,
    stopCamera,
    toggleCameraWatch,
    reset,
  };
}
