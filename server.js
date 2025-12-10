const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { createObjectCsvWriter } = require("csv-writer");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

// Email configuration - uses environment variables for security
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_TO = process.env.EMAIL_TO || "kr6550@princeton.edu";

// Create email transporter (Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(express.static("public"));

app.post("/save-data", async (req, res) => {
  const data = req.body;

  const participant_number = data[0].participant_number;
  const netid = data[0].netid;

  const filename = `p${participant_number}_${netid}_memory.csv`;
  const filepath = path.join(__dirname, "data", filename);

  const headers = Object.keys(data[0]).map(key => ({
    id: key,
    title: key
  }));

  // Convert data to CSV string for email attachment
  const csvHeader = headers.map(h => h.title).join(",");
  const csvRows = data.map(row => headers.map(h => `"${(row[h.id] || "").toString().replace(/"/g, '""')}"`).join(","));
  const csvContent = [csvHeader, ...csvRows].join("\n");

  // Save locally (works on local, ephemeral on Render)
  const csvWriter = createObjectCsvWriter({
    path: filepath,
    header: headers
  });

  try {
    await csvWriter.writeRecords(data);
    console.log(`✅ Data saved locally: ${filename}`);
  } catch (err) {
    console.error("Local save error:", err);
  }

  // Send email with CSV attachment
  if (EMAIL_USER && EMAIL_PASS) {
    try {
      await transporter.sendMail({
        from: EMAIL_USER,
        to: EMAIL_TO,
        subject: `Memory Experiment Data - ${netid} (P${participant_number})`,
        text: `New experiment data from participant ${participant_number} (${netid}).\n\nSee attached CSV file.`,
        attachments: [
          {
            filename: filename,
            content: csvContent
          }
        ]
      });
      console.log(`✅ Email sent for ${netid}`);
    } catch (emailErr) {
      console.error("Email error:", emailErr);
    }
  } else {
    console.log("⚠️ Email not configured (missing EMAIL_USER/EMAIL_PASS)");
  }

  res.json({ status: "success", filename });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
