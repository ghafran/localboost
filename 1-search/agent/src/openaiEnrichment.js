import OpenAI from "openai";

export function buildOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }
  return new OpenAI({ apiKey });
}

export async function enrichLeadList(client, rawBusinesses) {
  const model = process.env.OPENAI_MODEL || "gpt-5.4";

  const prompt = `You are a B2B lead-enrichment assistant for an agency.
Convert the raw business list into normalized lead records.

Rules:
- Return JSON only.
- Output shape: {"leads": Lead[]}
- Each Lead must contain:
  - name
  - phone
  - address
  - business_category
  - business_size
  - revenue_estimate
  - website
  - notes
- business_size must be one of: micro, small, medium, large, unknown
- revenue_estimate should be a compact string like "$250K-$1M" or "unknown"
- If size or revenue cannot be reasonably inferred, use "unknown"
- Make conservative estimates only.
- Notes must say whether an estimate was inferred from limited data.

Raw businesses:\n${JSON.stringify(rawBusinesses, null, 2)}`;

  const response = await client.responses.create({
    model,
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: "lead_search_result",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            leads: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string" },
                  phone: { type: "string" },
                  address: { type: "string" },
                  business_category: { type: "string" },
                  business_size: {
                    type: "string",
                    enum: ["micro", "small", "medium", "large", "unknown"]
                  },
                  revenue_estimate: { type: "string" },
                  website: { type: "string" },
                  notes: { type: "string" }
                },
                required: [
                  "name",
                  "phone",
                  "address",
                  "business_category",
                  "business_size",
                  "revenue_estimate",
                  "website",
                  "notes"
                ]
              }
            }
          },
          required: ["leads"]
        }
      }
    }
  });

  const payload = JSON.parse(response.output_text);
  return payload.leads;
}
