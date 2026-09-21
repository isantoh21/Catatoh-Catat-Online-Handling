import { FaceMesh, Results, NormalizedLandmarkList } from '@mediapipe/face_mesh';

// Key Google Face Mesh landmark indices for facial contours
export const FACEMESH_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
];

export const FACEMESH_LIPS = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95
];

export const FACEMESH_LEFT_EYE = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246
];

export const FACEMESH_RIGHT_EYE = [
  263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466
];

export const FACEMESH_LEFT_IRIS = [468, 469, 470, 471, 472];
export const FACEMESH_RIGHT_IRIS = [473, 474, 475, 476, 477];

export const FACEMESH_NOSE = [1, 2, 98, 327, 168, 197, 5, 4, 45, 275];

export class GoogleFaceMeshService {
  private faceMesh: FaceMesh | null = null;
  private isLoaded: boolean = false;
  private isInitializing: boolean = false;
  private lastResults: Results | null = null;

  async initialize(): Promise<boolean> {
    if (this.isLoaded && this.faceMesh) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    try {
      this.faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });

      this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true, // iris tracking
        minDetectionConfidence: 0.4,
        minTrackingConfidence: 0.4
      });

      this.faceMesh.onResults((results: Results) => {
        this.lastResults = results;
      });

      // Warm up
      this.isLoaded = true;
      this.isInitializing = false;
      return true;
    } catch (err) {
      console.warn('Google MediaPipe Face Mesh initialization fallback:', err);
      this.isInitializing = false;
      return false;
    }
  }

  async send(videoElement: HTMLVideoElement): Promise<Results | null> {
    if (!this.faceMesh || !this.isLoaded) {
      await this.initialize();
    }
    if (!this.faceMesh) return null;

    try {
      await this.faceMesh.send({ image: videoElement });
      return this.lastResults;
    } catch (e) {
      return null;
    }
  }

  getResults(): Results | null {
    return this.lastResults;
  }
}

export const googleFaceMeshService = new GoogleFaceMeshService();

/**
 * Draw Google Face Mesh on an overlay canvas (with mirrored coordinate support for front camera)
 */
export function drawGoogleFaceMesh(
  canvas: HTMLCanvasElement,
  landmarks: NormalizedLandmarkList,
  options?: {
    color?: string;
    showMeshPoints?: boolean;
    showContours?: boolean;
    showIrises?: boolean;
  }
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const color = options?.color || '#10b981'; // emerald
  const showPoints = options?.showMeshPoints ?? true;
  const showContours = options?.showContours ?? true;
  const showIrises = options?.showIrises ?? true;

  // Helper to get mirrored X (since front camera is flipped horizontally)
  const getPoint = (idx: number) => {
    const lm = landmarks[idx];
    if (!lm) return null;
    return {
      x: (1 - lm.x) * width, // Mirror flip
      y: lm.y * height,
      z: lm.z
    };
  };

  const drawPath = (indices: number[], closePath = true, strokeStyle = color, lineWidth = 1.5) => {
    ctx.beginPath();
    let first = true;
    for (const idx of indices) {
      const pt = getPoint(idx);
      if (!pt) continue;
      if (first) {
        ctx.moveTo(pt.x, pt.y);
        first = false;
      } else {
        ctx.lineTo(pt.x, pt.y);
      }
    }
    if (closePath) ctx.closePath();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };

  if (showContours) {
    // Face Oval
    drawPath(FACEMESH_OVAL, true, color, 1.8);
    // Lips
    drawPath(FACEMESH_LIPS, true, color === '#10b981' ? 'rgba(52, 211, 153, 0.85)' : color, 1.5);
    // Left & Right Eyes
    drawPath(FACEMESH_LEFT_EYE, true, 'rgba(45, 212, 191, 0.9)', 1.5);
    drawPath(FACEMESH_RIGHT_EYE, true, 'rgba(45, 212, 191, 0.9)', 1.5);
    // Nose bridge
    drawPath(FACEMESH_NOSE, false, 'rgba(16, 185, 129, 0.7)', 1.2);
  }

  // Draw Irises (High-Tech Iris Rings)
  if (showIrises && landmarks.length >= 478) {
    [FACEMESH_LEFT_IRIS, FACEMESH_RIGHT_IRIS].forEach(irisIndices => {
      const center = getPoint(irisIndices[0]);
      if (center) {
        ctx.beginPath();
        ctx.arc(center.x, center.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8'; // Sky blue glowing iris center
        ctx.fill();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }

  // Subtly render geometric mesh constellation dots across landmarks
  if (showPoints) {
    ctx.fillStyle = color === '#10b981' ? 'rgba(52, 211, 153, 0.75)' : color;
    // Step every 8 landmarks to keep it clean, elegant, and crisp
    for (let i = 0; i < landmarks.length; i += 7) {
      const pt = getPoint(i);
      if (pt) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
