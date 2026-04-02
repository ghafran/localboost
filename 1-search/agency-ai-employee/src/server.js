import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const model = process.env.OPENAI_MODEL || "gpt-5.4";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "../public");

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(express.json());
app.use(express.static(publicDir));

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashZip(zip) {
  return String(zip)
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function buildMockBusinesses(zip, count = 57) {
  const rand = mulberry32(hashZip(zip));
  const streets = ["Main St", "Oak Ave", "Maple Dr", "Broadway", "Elm St", "Pine Rd", "Cedar Ln"];
  const cities = ["Fairview", "Franklin", "Greenville", "Bristol", "Madison", "Clinton"];
  const categories = [
    "Roofing Contractor",
    "Dental Practice",
    "HVAC Company",
    "Law Firm",
    "Auto Repair",
    "Plumbing Service",
    "Real Estate Agency",
    "Landscaping",
    "Accounting Firm",
    "Med Spa"
  ];
  const sizeBands = ["1-10 employees", "11-25 employees", "26-50 employees", "51-100 employees"];
  const prefixes = ["Prime", "Blue", "Summit", "Elite", "North", "Metro", "Pioneer", "River", "Apex", "Gold"];
  const suffixes = ["Solutions", "Group", "Partners", "Works", "Experts", "Services", "Co", "Pros", "Studios", "Associates"];

  return Array.from({ length: count }, (_, i) => {
    const category = categories[i % categories.length];
    const city = cities[Math.floor(rand() * cities.length)];
    const streetNo = 100 + Math.floor(rand() * 9000);
    const street = streets[Math.floor(rand() * streets.length)];
    const size = sizeBands[Math.floor(rand() * sizeBands.length)];
    const revenueLow = (Math.floor(rand() * 18) + 2) * 250000;
    const revenueHigh = revenueLow + (Math.floor(rand() * 10) + 3) * 250000;
    const phone = `(${200 + Math.floor(rand() * 700)}) ${100 + Math.floor(rand() * 900)}-${1000 + Math.floor(rand() * 9000)}`;
    const name = `${prefixes[Math.floor(rand() * prefixes.length)]} ${category.split(" ")[0]} ${suffixes[Math.floor(rand() * suffixes.length)]}`;

    return {
      id: `${zip}-${i + 1}`,
      name,
      phone,
      address: `${streetNo} ${street}, ${city}, ST ${zip}`,
      businessCategory: category,
      businessSize: size,
      revenueEstimate: `$${(revenueLow / 1000000).toFixed(1)}M - $${(revenueHigh / 1000000).toFixed(1)}M`
    };
  });
}

async function normalizeWithAI(zip, pageItems) {
  if (!openai) return pageItems;

  const input = [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text:
            "You normalize local business lead records. Return only valid JSON. Preserve the number of records. Keep values concise. Do not invent facts beyond light normalization."
        }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: JSON.stringify({ zip, businesses: pageItems })
        }
      ]
    }
  ];

  const response = await openai.responses.create({
    model,
    input,
    text: {
      format: {
        type: "json_schema",
        name: "lead_search_page",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            businesses: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  phone: { type: "string" },
                  address: { type: "string" },
                  businessCategory: { type: "string" },
                  businessSize: { type: "string" },
                  revenueEstimate: { type: "string" }
                },
                required: [
                  "id",
                  "name",
                  "phone",
                  "address",
                  "businessCategory",
                  "businessSize",
                  "revenueEstimate"
                ]
              }
            }
          },
          required: ["businesses"]
        }
      }
    }
  });

  const parsed = JSON.parse(response.output_text);
  return Array.isArray(parsed.businesses) ? parsed.businesses : pageItems;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model, aiEnabled: Boolean(openai) });
});

app.post("/api/agents/lead-search", async (req, res) => {
  try {
    const zip = String(req.body?.zip || "").trim();
    const page = Math.max(parseInt(req.body?.page || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.body?.pageSize || "10", 10), 1), 50);

    if (!/^\d{5}$/.test(zip)) {
      return res.status(400).json({ error: "ZIP code must be 5 digits." });
    }

    const allBusinesses = buildMockBusinesses(zip, 57);
    const total = allBusinesses.length;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const rawItems = allBusinesses.slice(start, start + pageSize);
    const businesses = await normalizeWithAI(zip, rawItems);

    res.json({
      zip,
      businesses,
      paging: {
        page: safePage,
        pageSize,
        total,
        totalPages,
        hasPreviousPage: safePage > 1,
        hasNextPage: safePage < totalPages
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lead search failed." });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Agency AI Employee running on http://localhost:${port}`);
});
