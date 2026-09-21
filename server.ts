import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Body parser for JSON with large payload (for base64 webcam photos)
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Lazy initialization for Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured");
    }
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    time: new Date().toISOString(),
  });
});

// Helper to strip base64 data prefix
function cleanBase64(dataUrl: string): { mimeType: string; data: string } {
  if (dataUrl.includes(";base64,")) {
    const parts = dataUrl.split(";base64,");
    const mimeMatch = parts[0].match(/:(.*?)$/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    return { mimeType, data: parts[1] };
  }
  return { mimeType: "image/jpeg", data: dataUrl };
}

// API: Verify Attendance using Gemini 2.5 Flash Multimodal Vision
app.post("/api/gemini/verify-attendance", async (req, res) => {
  try {
    const { liveImage, candidates, attendanceType, schoolName, role = 'teacher' } = req.body;
    const isStudent = role === 'student';

    if (!liveImage) {
      return res.status(400).json({
        success: false,
        error: "liveImage is required",
      });
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        success: false,
        error: "candidates array is required and must not be empty",
      });
    }

    const ai = getGemini();
    const liveClean = cleanBase64(liveImage);

    // Build prompt parts
    const parts: any[] = [];

    // Attach live image as primary part
    parts.push({
      inlineData: {
        mimeType: liveClean.mimeType,
        data: liveClean.data,
      },
    });

    // Attach reference photos if candidates provide them
    const validPhotoCandidates: any[] = [];
    candidates.forEach((cand: any, idx: number) => {
      const photoStr = cand.photo || cand.profile_picture;
      if (photoStr && typeof photoStr === "string" && photoStr.length > 50) {
        const refClean = cleanBase64(photoStr);
        parts.push({
          inlineData: {
            mimeType: refClean.mimeType,
            data: refClean.data,
          },
        });
        validPhotoCandidates.push({
          index: idx,
          id: cand.id,
          name: cand.name || cand.nama_lengkap,
          nip: cand.nip || cand.nis || cand.kelompok || "-",
          hasPhoto: true,
        });
      } else {
        validPhotoCandidates.push({
          index: idx,
          id: cand.id,
          name: cand.name || cand.nama_lengkap,
          nip: cand.nip || cand.nis || cand.kelompok || "-",
          hasPhoto: false,
        });
      }
    });

    const candidatesSummary = validPhotoCandidates
      .map((c, i) => `[ID: "${c.id}", Name: "${c.name}", Code: "${c.nip || "-"}", HasPhoto: ${c.hasPhoto}]`)
      .join("\n");

    const promptText = `
You are the intelligent biometric vision AI for the school attendance kiosk at "${schoolName || "Sekolah"}".
The ${isStudent ? 'student' : 'teacher'} is performing "${attendanceType === "in" ? "ABSEN MASUK (Datang)" : "ABSEN PULANG"}".

TASK:
1. Examine the LIVE CAMERA snapshot (the first image provided).
2. Check if there is a real human face looking towards the camera (with reasonable lighting and angle).
3. Compare the live person against the registered ${isStudent ? 'student' : 'teacher'} candidate list and their reference photos:
Registered Candidates:
${candidatesSummary}

4. Determine if the live person matches any registered ${isStudent ? 'student' : 'teacher'} with reasonable confidence (match confidence score >= 50%).
   - Be tolerant and forgiving of natural variations such as differences in lighting, camera angles, distance, facial expressions, hairstyles, glasses, hijab, or slight facial aging.
   - If the person plausibly matches one of the registered candidates, set "matched": true and specify their ID and confidence (50-100%).
5. Generate an encouraging, natural Indonesian voice greeting for the ${isStudent ? 'student' : 'teacher'} (e.g., ${isStudent ? '"Selamat pagi [Name], absensi kehadiranmu berhasil dicatat. Semangat belajarnya hari ini!"' : '"Selamat pagi Ibu/Bapak [Name], absen [masuk/pulang] berhasil dicatat. Semangat bertugas!"'}).

Return strictly JSON adhering to the specified schema.
`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isHumanFaceDetected: {
              type: Type.BOOLEAN,
              description: "Whether a clear human face was detected in the live camera image",
            },
            isRealPerson: {
              type: Type.BOOLEAN,
              description: "Liveness check: true if real living person, false if photo/screen replay attack or invalid",
            },
            matched: {
              type: Type.BOOLEAN,
              description: "True if live face matches one of the registered candidates with >= 75% confidence",
            },
            matchedTeacherId: {
              type: Type.STRING,
              description: "The exact ID of the matched teacher, or empty string if not matched",
            },
            matchedTeacherName: {
              type: Type.STRING,
              description: "The name of the matched teacher, or empty string if not matched",
            },
            confidence: {
              type: Type.NUMBER,
              description: "Confidence percentage of the match (0 to 100)",
            },
            livenessReason: {
              type: Type.STRING,
              description: "Brief note or guidance in Indonesian (e.g. 'Wajah terdeteksi jelas', 'Posisikan wajah menghadap lurus')",
            },
            greeting: {
              type: Type.STRING,
              description: "Polite and cheerful Indonesian greeting to be spoken to the teacher",
            },
          },
          required: [
            "isHumanFaceDetected",
            "isRealPerson",
            "matched",
            "matchedTeacherId",
            "matchedTeacherName",
            "confidence",
            "greeting",
          ],
        },
      },
    });

    const rawText = response.text?.trim() || "{}";
    const result = JSON.parse(rawText);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Gemini attendance verification error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to process attendance with Gemini Vision",
    });
  }
});

// API: Register / Validate Face with Gemini 2.5 Flash Vision
app.post("/api/gemini/register-face", async (req, res) => {
  try {
    const { image, teacherName } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: "image is required",
      });
    }

    const ai = getGemini();
    const cleanImg = cleanBase64(image);

    const parts = [
      {
        inlineData: {
          mimeType: cleanImg.mimeType,
          data: cleanImg.data,
        },
      },
      {
        text: `
You are an AI face registration assistant for teacher "${teacherName || "Guru"}".
Analyze this photo to ensure it meets high-quality biometric requirements for school attendance.

Check:
1. Is there exactly 1 clear human face in the photo?
2. Are the eyes open and face clearly visible with decent lighting?
3. Provide a brief visual summary of face features to aid future matching (e.g., gender, glasses, facial hair, hijab, haircut).
4. Provide a friendly validation message in Indonesian.

Return strictly JSON adhering to the schema.
`,
      },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValidFace: {
              type: Type.BOOLEAN,
              description: "True if there is exactly 1 clear, well-lit human face suitable for attendance",
            },
            faceCount: {
              type: Type.INTEGER,
              description: "Number of faces detected in the image",
            },
            feedback: {
              type: Type.STRING,
              description: "Indonesian feedback to display to the user",
            },
            visualProfile: {
              type: Type.STRING,
              description: "Brief visual characteristics description in Indonesian",
            },
          },
          required: ["isValidFace", "faceCount", "feedback", "visualProfile"],
        },
      },
    });

    const rawText = response.text?.trim() || "{}";
    const result = JSON.parse(rawText);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Gemini register face error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to analyze face photo with Gemini",
    });
  }
});

// API: Generate warm Indonesian voice greeting for attendance success (Gemini Text-to-Speech prompt)
app.post("/api/gemini/generate-greeting", async (req, res) => {
  try {
    const { name, attendanceType, time, schoolName, role = 'teacher' } = req.body;
    const isStudent = role === 'student';
    const ai = getGemini();

    const isDatang = attendanceType === 'in';
    const typeLabel = isDatang ? 'Absen Datang (Masuk)' : 'Absen Pulang';
    const prompt = isStudent
      ? `
Buatkan 1 kalimat sapaan suara (Text-to-Speech) bahasa Indonesia yang ramah, hangat, ceria, dan memotivasi seorang murid/siswa bernama "${name || "Siswa"}" yang baru saja berhasil melakukan "${typeLabel}" di sekolah "${schoolName || "Sekolah"}".

Ketentuan:
1. Jika Absen Datang: Berikan ucapan selamat pagi/siang ceria, sebut nama siswa secara hangat, konfirmasi absensi berhasil, dan berikan semangat belajar yang menyenangkan (Contoh: "Selamat pagi ${name || "Siswa"}, absensimu berhasil dicatat. Semangat belajar dan raih prestasi hari ini!").
2. Jika Absen Pulang: Berikan ucapan terima kasih telah belajar giat hari ini, konfirmasi absensi pulang berhasil, doakan keselamatan di perjalanan dan selamat beristirahat (Contoh: "Hebat sekali hari ini ${name || "Siswa"}, absen pulangmu telah tercatat. Hati-hati di jalan dan selamat beristirahat di rumah!").
3. Panjang maksimal 1-2 kalimat ringkas, natural untuk dibacakan oleh mesin suara Text-to-Speech tanpa simbol aneh, markdown, atau emoji.

Keluarkan teks sapaan saja secara langsung.
`
      : `
Buatkan 1 kalimat sapaan suara (Text-to-Speech) bahasa Indonesia yang ramah, sopan, antusias, dan menghargai seorang guru bernama "${name || "Bapak/Ibu Guru"}" yang baru saja berhasil melakukan "${typeLabel}" di sekolah "${schoolName || "Sekolah"}".

Ketentuan:
1. Jika Absen Datang: Berikan ucapan selamat pagi atau siang, sebutkan nama guru secara terhormat, konfirmasi kehadiran berhasil, dan berikan doa atau semangat mengajar yang menyenangkan. (Contoh: "Selamat pagi Bapak ${name || "Guru"}, absensi datang berhasil dicatat. Selamat mendidik dan semangat bertugas hari ini!")
2. Jika Absen Pulang: Berikan ucapan terima kasih atas dedikasinya hari ini, konfirmasi absensi pulang berhasil, dan doakan selamat istirahat serta perjalanan pulang yang aman. (Contoh: "Terima kasih Ibu ${name || "Guru"}, absensi pulang Anda telah tercatat dengan baik. Selamat beristirahat bersama keluarga dan hati-hati di jalan!")
3. Panjang maksimal 1-2 kalimat ringkas, natural untuk dibacakan oleh mesin suara Text-to-Speech tanpa simbol aneh, markdown, atau emoji.

Keluarkan teks sapaan saja secara langsung.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });

    const defaultGreeting = isStudent
      ? (isDatang 
          ? `Selamat datang ${name || "Siswa"}, absensi hadirmu berhasil dicatat. Semangat belajarnya hari ini!`
          : `Terima kasih ${name || "Siswa"}, absensi pulangmu tercatat. Hati-hati di jalan dan selamat istirahat!`)
      : (isDatang 
          ? `Selamat datang ${name || "Bapak/Ibu Guru"}, absensi datang Anda berhasil dicatat. Selamat bertugas!` 
          : `Terima kasih ${name || "Bapak/Ibu Guru"}, absensi pulang berhasil dicatat. Selamat beristirahat dan hati-hati di jalan!`);

    const greeting = response.text?.trim().replace(/^["']|["']$/g, "") || defaultGreeting;

    return res.json({
      success: true,
      greeting,
    });
  } catch (error: any) {
    console.error("Gemini generate-greeting error:", error);
    const isDatang = req.body?.attendanceType === 'in';
    const isStudent = req.body?.role === 'student';
    const name = req.body?.name || (isStudent ? "Siswa" : "Bapak/Ibu Guru");
    const fallback = isStudent
      ? (isDatang
          ? `Selamat datang ${name}, absensi hadirmu berhasil dicatat. Semangat belajarnya hari ini!`
          : `Terima kasih ${name}, absensi pulangmu tercatat. Hati-hati di jalan dan selamat istirahat!`)
      : (isDatang
          ? `Selamat datang ${name}, absensi datang Anda berhasil dicatat. Selamat bertugas!`
          : `Terima kasih ${name}, absensi pulang berhasil dicatat. Selamat beristirahat dan hati-hati di jalan!`);
    return res.json({
      success: true,
      greeting: fallback,
      fallback: true
    });
  }
});

// Start server with Vite middleware (development) or static files (production)
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
