import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import fs from "fs";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.post("/api/extract", async (req, res) => {
    const { isoPath, destinationPath } = req.body;

    if (!isoPath || !destinationPath) {
      return res.status(400).json({ error: "Missing paths" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendLog = (data: string) => {
      res.write(`data: ${JSON.stringify({ log: data })}\n\n`);
    };

    try {
      const assetsDir = path.join(__dirname, "assets");
      const assetPath = path.join(assetsDir, "extract-xiso");
      
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir);
      }

      let isMock = false;
      if (!fs.existsSync(assetPath)) {
        isMock = true;
        const mockScript = `#!/bin/bash
echo "TITAN R9 EXTRACTION ENGINE v2.4.0"
echo "---------------------------------"
# Simulate potential errors based on input
if [[ "$3" == *"error"* ]]; then
  echo "ERROR: Invalid XISO signature (0x00000000)" >&2
  exit 1
elif [[ "$3" == *"permission"* ]]; then
  echo "ERROR: Permission denied accessing $3" >&2
  exit 13
elif [[ ! -f "$3" && "$3" != "mock_file.iso" ]]; then
  echo "ERROR: File not found: $3" >&2
  exit 2
fi

echo "INITIALIZING CORE..."
sleep 1
echo "MOUNTING IMAGE: $3"
sleep 1
echo "VALIDATING XISO SIGNATURE..."
sleep 0.5
echo "SIGNATURE VALID: 0x5849534F"
echo "SCANNING DIRECTORY TREE..."
sleep 1
echo "FOUND 142 FILES | TOTAL SIZE: 4.2GB"
echo "---------------------------------"
echo "STARTING EXTRACTION TO: $2"
for i in {1..10}
do
  PERCENT=$((i * 10))
  echo "EXTRACTING DATA BLOCKS [\${PERCENT}%]..."
  sleep 0.5
done
echo "---------------------------------"
echo "VERIFYING DATA INTEGRITY..."
sleep 0.5
echo "CHECKSUM MATCHED: CRC32-0x8F2B1A"
echo "EXTRACTION COMPLETE."
`;
        fs.writeFileSync(assetPath, mockScript);
        fs.chmodSync(assetPath, "755");
      }

      const tempDir = path.join(__dirname, "temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
      const binaryPath = path.join(tempDir, "extract-xiso");
      
      fs.copyFileSync(assetPath, binaryPath);
      fs.chmodSync(binaryPath, "755");

      if (isMock) {
        sendLog("NOTICE: Running in SIMULATION MODE");
      }

      const child = spawn(binaryPath, ["-d", destinationPath, isoPath]);
      let stderrData = "";

      child.stdout.on("data", (data) => {
        const lines = data.toString().split("\n");
        lines.forEach((line: string) => {
          if (line.trim()) sendLog(line);
        });
      });

      child.stderr.on("data", (data) => {
        const msg = data.toString();
        stderrData += msg;
        sendLog(`ERROR: ${msg}`);
      });

      child.on("close", (code) => {
        if (code === 0) {
          res.write(`data: ${JSON.stringify({ success: true })}\n\n`);
        } else {
          let specificError = "Extraction failed";
          
          if (stderrData.toLowerCase().includes("permission denied")) {
            specificError = "PERMISSION DENIED: Access restricted to the specified path.";
          } else if (stderrData.toLowerCase().includes("not found")) {
            specificError = "FILE NOT FOUND: The source ISO file could not be located.";
          } else if (stderrData.toLowerCase().includes("signature") || stderrData.toLowerCase().includes("invalid")) {
            specificError = "INVALID FORMAT: The file is not a valid XISO image.";
          } else if (code === 13) {
            specificError = "EACCES: Permission denied during execution.";
          } else if (code === 2) {
            specificError = "ENOENT: Source or destination path does not exist.";
          } else {
            specificError = `SYSTEM ERROR (Code ${code}): ${stderrData.trim() || "Unknown process error"}`;
          }

          res.write(`data: ${JSON.stringify({ success: false, error: specificError })}\n\n`);
        }
        res.end();
      });

      child.on("error", (err: any) => {
        let errorMsg = `Failed to start engine: ${err.message}`;
        if (err.code === 'EACCES') errorMsg = "Permission denied: Cannot execute extraction engine.";
        if (err.code === 'ENOENT') errorMsg = "Engine binary not found in temporary storage.";
        
        res.write(`data: ${JSON.stringify({ success: false, error: errorMsg })}\n\n`);
        res.end();
      });

    } catch (error) {
      console.error("System Error:", error);
      res.write(`data: ${JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) })}\n\n`);
      res.end();
    }
  });

  // API to check engine status
  app.get("/api/engine-status", (req, res) => {
    const assetPath = path.join(__dirname, "assets", "extract-xiso");
    const exists = fs.existsSync(assetPath);
    // If it exists, check if it's our mock or a real binary
    let type = "NOT_FOUND";
    if (exists) {
      const content = fs.readFileSync(assetPath, "utf8");
      type = content.includes("TITAN R9 EXTRACTION ENGINE") ? "SIMULATED" : "NATIVE";
    }
    res.json({ exists, type });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
