require("dotenv").config();

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require("path");
const PDFDocument = require("pdfkit");

const app = express();
const port = process.env.PORT || 5000;

// Multer setup (save uploads to /upload)
const upload = multer({
    dest: "upload/",
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed!"), false);
        }
    }
});

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Initialize Google Generative AI
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post("/analyze", upload.single("image"), async (req, res) => {
  const file = req.file;

  try {
    if (!file) {
      return res.status(400).json({ msg: "No image uploaded" });
    }

    const imagePath = file.path;

    // Read file as base64
    const imageData = fs.readFileSync(imagePath, { encoding: "base64" });

    // Ensure correct mimeType
    const mimeType = file.mimetype.startsWith("image/")
      ? file.mimetype
      : "image/jpeg";

    const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });

    // ✅ Correct usage: pass an array with objects directly
    const result = await model.generateContent([
       {
          text: "Analyze the uploaded plant image and provide a detailed response in plain text only (no markdown or formatting). Include the following in your analysis:\n\n1. The most likely species or type of the plant.\n2. The overall health condition of the plant and signs of any disease, deficiency, or stress.\n3. Key physical characteristics that help identify the plant.\n4. Step-by-step care instructions including watering, sunlight, soil, fertilizer, temperature, and pruning needs.\n5. Important precautions to prevent disease, pests, or damage.\n6. Any interesting facts, benefits, or traditional uses of the plant.\n\nGive the response in clear, structured sentences with each section explained in detail."
        },
      {
        inlineData: {
          mimeType: mimeType,
          data: imageData,
        },
      },
    ]);

    const imageInfo = result.response.text();

    res.json({
      result: imageInfo,
      image: `data:${mimeType};base64,${imageData}`,
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});


app.post("/download", express.json(), async (req, res) => {
  try {
    const { result, image } = req.body;

    const reportDir = path.join(__dirname, "reports");
    await fs.promises.mkdir(reportDir, { recursive: true });

    const fileName = `Plant_Analysis_Report_${Date.now()}.pdf`;
    const filePath = path.join(reportDir, fileName);

    // Create PDF
    const doc = new PDFDocument();

    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    doc.fontSize(24).text("Plant Analysis Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    doc.fontSize(14).text(result, { align: "left" });

    // Insert image if provided
    if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const imageBuffer = Buffer.from(base64Data, "base64");

      const tempImgPath = path.join(reportDir, `temp_${Date.now()}.png`);
      await fs.promises.writeFile(tempImgPath, imageBuffer);

      doc.addPage().image(tempImgPath, {
        fit: [500, 400],
        align: "center",
        valign: "center",
      });

      // delete temp image later
      writeStream.on("finish", async () => {
        await fs.promises.unlink(tempImgPath);
      });
    }

    doc.end();

    // Wait for PDF to finish writing
    writeStream.on("finish", () => {
      res.download(filePath, (err) => {
        if (err) {
          console.error("Download error:", err);
          res.status(500).json({ error: err.message });
        }
        // Delete file after sending
        fs.promises.unlink(filePath).catch(console.error);
      });
    });

    writeStream.on("error", (err) => {
      console.error("Write error:", err);
      res.status(500).json({ error: err.message });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});


app.listen(port, () => {
    console.log(`App is running on port ${port}`);
});
