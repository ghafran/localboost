import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { searchBusinessesByZip as searchMock } from "./mockProvider.js";
import { searchBusinessesByZipYelp } from "./yelpProvider.js";
import { buildOpenAIClient, enrichLeadList } from "./openaiEnrichment.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

function validateZipCode(zipCode) {
  return /^\d{5}$/.test(zipCode);
}

async function getBusinessResults(zipCode) {
  const yelpKey = process.env.YELP_API_KEY;
  if (yelpKey) {
    const businesses = await searchBusinessesByZipYelp(zipCode, yelpKey);
    return { source: "yelp", businesses };
  }

  const businesses = await searchMock(zipCode);
  return { source: "mock", businesses };
}

app.post("/api/lead-search", async (req, res) => {
  try {
    const zipCode = String(req.body?.zipCode || "").trim();
    if (!validateZipCode(zipCode)) {
      return res.status(400).json({ error: "zipCode must be a 5-digit US ZIP code" });
    }

    const { source, businesses } = await getBusinessResults(zipCode);
    const openai = buildOpenAIClient();
    const leads = await enrichLeadList(openai, businesses);

    return res.json({
      zipCode,
      source,
      count: leads.length,
      leads
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown server error"
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Agency AI Employee running at http://localhost:${port}`);
});
