const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { createObjectCsvWriter } = require("csv-writer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(express.static("public"));

app.post("/save-data", (req, res) => {
  const data = req.body;

  const participant_number = data[0].participant_number;
  const netid = data[0].netid;

  const filename = `p${participant_number}_${netid}_memory.csv`;
  const filepath = path.join(__dirname, "data", filename);

  const headers = Object.keys(data[0]).map(key => ({
    id: key,
    title: key
  }));

  const csvWriter = createObjectCsvWriter({
    path: filepath,
    header: headers
  });

  csvWriter.writeRecords(data)
    .then(() => {
      res.json({ status: "success", filename });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ status: "error" });
    });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
