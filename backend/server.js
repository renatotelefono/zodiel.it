import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "../frontend");

// Serve frontend statico e disabilita cache per index.html
app.use(
  express.static(frontendPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

// Mappa di default: per ogni locale, una voce predefinita
const DEFAULT_VOICE_BY_LOCALE = {
  "en-US": "en-US-GuyNeural",
  "it-IT": "it-IT-DiegoNeural", // oppure "it-IT-ElsaNeural"
};

// Endpoint TTS con scelta lingua/voce
app.post("/tts", async (req, res) => {
  try {
    const { text, locale, voice, format } = req.body ?? {};

    if (!text || typeof text !== "string") {
      return res.status(400).send("Missing 'text'.");
    }

    const chosenLocale =
      locale && DEFAULT_VOICE_BY_LOCALE[locale] ? locale : "en-US";
    const chosenVoice = voice || DEFAULT_VOICE_BY_LOCALE[chosenLocale];
    const audioFormat = format || "audio-16khz-32kbitrate-mono-mp3";

    const escapeXml = (s) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    const ssml = `
<speak version="1.0" xml:lang="${chosenLocale}">
  <voice name="${chosenVoice}">${escapeXml(text)}</voice>
</speak>`.trim();

    const response = await fetch(
      `https://${process.env.AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": process.env.AZURE_KEY,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": audioFormat,
        },
        body: ssml,
      }
    );

    if (!response.ok) {
      const msg = await response.text();
      return res.status(response.status).send(msg);
    }

    res.setHeader(
      "Content-Type",
      audioFormat.includes("mp3") ? "audio/mpeg" : "audio/wav"
    );
    response.body.pipe(res);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Route catch-all compatibile con Express 5
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server attivo su http://localhost:${PORT}`)
);
