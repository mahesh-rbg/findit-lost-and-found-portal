
const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const ITEMS_FILE = path.join(DATA_DIR, "items.json");
const CLAIMS_FILE = path.join(DATA_DIR, "claims.json");

app.use(
  cors({
    origin: [
      "http://localhost:4200",
      "http://127.0.0.1:4200",
    ],
  })
);

app.use(express.json({ limit: "1mb" }));

// Read JSON files.
async function readJson(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

// Write JSON files.
async function writeJson(filePath, data) {
  await fs.writeFile(
    filePath,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

// Initialize storage files.
async function initializeFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  for (const file of [ITEMS_FILE, CLAIMS_FILE]) {
    try {
      await fs.access(file);
    } catch {
      await writeJson(file, []);
    }
  }
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Health check.
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "FindIt backend is running.",
  });
});

// GET: Fetch items and their contact details.
app.get("/api/items", async (req, res) => {
  try {
    const items = await readJson(ITEMS_FILE);

    const search = String(req.query.search || "")
      .trim()
      .toLowerCase();

    const status = String(req.query.status || "ALL")
      .trim()
      .toUpperCase();

    const category = String(req.query.category || "ALL")
      .trim()
      .toLowerCase();

    const filteredItems = items.filter((item) => {
      const searchableText = [
        item.name,
        item.category,
        item.location,
        item.description,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !search || searchableText.includes(search);

      const matchesStatus =
        status === "ALL" || item.status === status;

      const matchesCategory =
        category === "all" ||
        String(item.category).toLowerCase() === category;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory
      );
    });

    // This prototype returns contact details publicly.
    res.json(filteredItems);
  } catch (error) {
    console.error("Error loading items:", error);

    res.status(500).json({
      success: false,
      message: "Could not load item listings.",
    });
  }
});

// POST: Create a LOST or FOUND report.
app.post("/api/items", async (req, res) => {
  try {
    const name = cleanText(req.body.name);
    const category = cleanText(req.body.category);
    const location = cleanText(req.body.location);
    const date = cleanText(req.body.date);
    const status = cleanText(req.body.status).toUpperCase();
    const description = cleanText(req.body.description);
    const contactName = cleanText(req.body.contactName);
    const contactMethod = cleanText(req.body.contactMethod);

    if (
      !name ||
      !category ||
      !location ||
      !date ||
      !contactName ||
      !contactMethod
    ) {
      return res.status(400).json({
        success: false,
        message: "Complete all required fields, including contact details.",
      });
    }

    if (!["LOST", "FOUND"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be LOST or FOUND.",
      });
    }

    const item = {
      id: crypto.randomUUID(),
      name,
      category,
      location,
      date,
      status,
      description,
      contactName,
      contactMethod,
      createdAt: new Date().toISOString(),
    };

    const items = await readJson(ITEMS_FILE);

    items.push(item);

    await writeJson(ITEMS_FILE, items);

    res.status(201).json({
      success: true,
      message: "Report submitted successfully.",
      item,
    });
  } catch (error) {
    console.error("Error saving report:", error);

    res.status(500).json({
      success: false,
      message: "Could not save the report.",
    });
  }
});

// DELETE: Remove an item and its associated claims.
app.delete("/api/items/:id", async (req, res) => {
  try {
    const itemId = String(req.params.id);
    const items = await readJson(ITEMS_FILE);

    const exists = items.some(
      (item) => String(item.id) === itemId
    );

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Item not found or already deleted.",
      });
    }

    const updatedItems = items.filter(
      (item) => String(item.id) !== itemId
    );

    const claims = await readJson(CLAIMS_FILE);

    const updatedClaims = claims.filter(
      (claim) => String(claim.itemId) !== itemId
    );

    await writeJson(ITEMS_FILE, updatedItems);
    await writeJson(CLAIMS_FILE, updatedClaims);

    res.json({
      success: true,
      message: "Item deleted successfully.",
      deletedItemId: itemId,
    });
  } catch (error) {
    console.error("Error deleting item:", error);

    res.status(500).json({
      success: false,
      message: "Could not delete the item.",
    });
  }
});

// POST: Submit a claim for a FOUND item.
app.post("/api/claims", async (req, res) => {
  try {
    const itemId = cleanText(req.body.itemId);
    const claimantName = cleanText(req.body.claimantName);
    const contactMethod = cleanText(req.body.contactMethod);
    const message = cleanText(req.body.message);

    if (!itemId || !claimantName || !contactMethod) {
      return res.status(400).json({
        success: false,
        message: "Complete all required claim fields.",
      });
    }

    const items = await readJson(ITEMS_FILE);

    const item = items.find(
      (entry) => String(entry.id) === itemId
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found.",
      });
    }

    if (item.status !== "FOUND") {
      return res.status(400).json({
        success: false,
        message: "Only FOUND items can receive claims.",
      });
    }

    const claim = {
      id: crypto.randomUUID(),
      itemId,
      claimantName,
      contactMethod,
      message,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };

    const claims = await readJson(CLAIMS_FILE);

    claims.push(claim);

    await writeJson(CLAIMS_FILE, claims);

    res.status(201).json({
      success: true,
      message: "Claim request submitted successfully.",
      claimId: claim.id,
    });
  } catch (error) {
    console.error("Error submitting claim:", error);

    res.status(500).json({
      success: false,
      message: "Could not submit the claim.",
    });
  }
});

// Handle unknown API routes.
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found.",
  });
});

// Start the server.
initializeFiles()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`FindIt backend running at http://localhost:${PORT}`);
      console.log(`Items API: http://localhost:${PORT}/api/items`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  })
  .catch((error) => {
    console.error("Backend initialization failed:", error);
    process.exit(1);
  });
