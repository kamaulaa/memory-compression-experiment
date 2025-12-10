const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { createObjectCsvWriter } = require("csv-writer");

const app = express();
const PORT = process.env.PORT || 3000;

// GitHub configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || "kamaulaa/memory-compression-experiment";

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(express.static("public"));

// Function to push file to GitHub
async function pushToGitHub(filename, content) {
  if (!GITHUB_TOKEN) {
    console.log("⚠️ GitHub not configured (missing GITHUB_TOKEN)");
    return false;
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/data/${filename}`;
  
  try {
    // Check if file exists (to get SHA for update)
    let sha = null;
    try {
      const checkResponse = await fetch(apiUrl, {
        headers: {
          "Authorization": `token ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json"
        }
      });
      if (checkResponse.ok) {
        const existing = await checkResponse.json();
        sha = existing.sha;
      }
    } catch (e) {
      // File doesn't exist, that's fine
    }

    // Create or update file
    const body = {
      message: `Add data: ${filename}`,
      content: Buffer.from(content).toString("base64"),
      branch: "main"
    };
    if (sha) body.sha = sha;

    const response = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        "Authorization": `token ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      console.log(`✅ Pushed to GitHub: ${filename}`);
      return true;
    } else {
      const error = await response.json();
      console.error("❌ GitHub error:", error.message);
      return false;
    }
  } catch (err) {
    console.error("❌ GitHub error:", err.message);
    return false;
  }
}

app.post("/save-data", async (req, res) => {
  const data = req.body;

  const participant_number = data[0].participant_number;
  const netid = data[0].netid;

  // Filter to only recall trials (they have sequence and recall fields)
  const recallTrials = data.filter(row => row.sequence && row.recall !== undefined);

  const filename = `p${participant_number}_${netid}_memory.csv`;
  const filepath = path.join(__dirname, "data", filename);

  // Define only the columns we want
  const headers = [
    { id: "participant_number", title: "participant_number" },
    { id: "netid", title: "netid" },
    { id: "sequence", title: "sequence" },
    { id: "recall", title: "recall" },
    { id: "correct_count", title: "correct_count" },
    { id: "total_letters", title: "total_letters" },
    { id: "accuracy", title: "accuracy" },
    { id: "compressibility", title: "compressibility" },
    { id: "pattern_type", title: "pattern_type" },
    { id: "rt_seconds", title: "rt_seconds" }
  ];

  // Convert data to CSV string
  const csvHeader = headers.map(h => h.title).join(",");
  const csvRows = recallTrials.map(row => headers.map(h => {
    const val = row[h.id];
    if (val === null || val === undefined) return '""';
    return `"${val.toString().replace(/"/g, '""')}"`;
  }).join(","));
  const csvContent = [csvHeader, ...csvRows].join("\n");

  // Save locally (works on local, ephemeral on Render)
  const csvWriter = createObjectCsvWriter({
    path: filepath,
    header: headers
  });

  try {
    await csvWriter.writeRecords(recallTrials);
    console.log(`✅ Data saved locally: ${filename} (${recallTrials.length} trials)`);
  } catch (err) {
    console.error("Local save error:", err);
  }

  // Push to GitHub
  await pushToGitHub(filename, csvContent);

  res.json({ status: "success", filename, trials: recallTrials.length });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
