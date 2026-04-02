import OpenAI from 'openai';
import { z } from 'zod';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const categorySchema = z.object({
  score: z.number().min(0).max(100),
  status: z.enum(['poor', 'fair', 'good', 'strong']),
  findings: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([])
});

const reportSchema = z.object({
  companyName: z.string(),
  zipCode: z.string(),
  summary: z.string(),
  totalScore: z.number().min(0).max(100),
  categories: z.object({
    seo: categorySchema,
    aeo: categorySchema,
    maps: categorySchema,
    yelp: categorySchema,
    social: categorySchema,
    website: categorySchema
  }),
  dataQualityNotes: z.array(z.string()).default([]),
  rawSignals: z.object({}).passthrough()
});

export async function evaluateCompany({ companyName, zipCode }) {
  const signals = await collectSignals({ companyName, zipCode });
  const aiReport = await buildAiScorecard({ companyName, zipCode, signals });

  const parsed = reportSchema.safeParse({
    ...aiReport,
    companyName,
    zipCode,
    rawSignals: signals
  });

  if (!parsed.success) {
    throw new Error(`AI response validation failed: ${parsed.error.message}`);
  }

  return parsed.data;
}

async function collectSignals({ companyName, zipCode }) {
  const website = await discoverOfficialWebsite(companyName, zipCode);

  const websiteSignals = await safely(() => inspectWebsite(website?.url), { found: false, note: 'Website inspection failed.' });
  const seoSignals = await safely(() => getSearchSignals(companyName, zipCode), { note: 'SEO search signals unavailable.' });
  const mapsSignals = await safely(() => getGoogleMapsSignals(companyName, zipCode), { note: 'Maps signals unavailable.' });
  const yelpSignals = await safely(() => getYelpSignals(companyName, zipCode), { note: 'Yelp signals unavailable.' });
  const socialSignals = await safely(() => getSocialSignals(companyName, zipCode, websiteSignals?.socialLinks || []), { note: 'Social signals unavailable.' });

  const aeoSignals = deriveAeoSignals({ websiteSignals, seoSignals, mapsSignals });

  return {
    companyName,
    zipCode,
    websiteDiscovery: website,
    websiteSignals,
    seoSignals,
    aeoSignals,
    mapsSignals,
    yelpSignals,
    socialSignals,
    collectedAt: new Date().toISOString()
  };
}

async function buildAiScorecard({ companyName, zipCode, signals }) {
  const prompt = `You are evaluating a local business's online presence for a digital marketing agency.
Return STRICT JSON only.

Business:
- Company: ${companyName}
- Zip code: ${zipCode}

Scoring rules:
- Score each category 0-100.
- Status mapping: 0-39 poor, 40-59 fair, 60-79 good, 80-100 strong.
- Use only the provided signals.
- If signals are missing, note that in dataQualityNotes and score conservatively.
- AEO means answer engine optimization: structured data, FAQ/answer-ready content, knowledge graph consistency, local entity clarity, and machine-readable answers.
- Improvements must be specific and actionable.

Required JSON shape:
{
  "summary": "string",
  "totalScore": 0,
  "categories": {
    "seo": {"score": 0, "status": "poor|fair|good|strong", "findings": ["..."], "improvements": ["..."]},
    "aeo": {"score": 0, "status": "poor|fair|good|strong", "findings": ["..."], "improvements": ["..."]},
    "maps": {"score": 0, "status": "poor|fair|good|strong", "findings": ["..."], "improvements": ["..."]},
    "yelp": {"score": 0, "status": "poor|fair|good|strong", "findings": ["..."], "improvements": ["..."]},
    "social": {"score": 0, "status": "poor|fair|good|strong", "findings": ["..."], "improvements": ["..."]},
    "website": {"score": 0, "status": "poor|fair|good|strong", "findings": ["..."], "improvements": ["..."]}
  },
  "dataQualityNotes": ["..."]
}

Signals:
${JSON.stringify(signals, null, 2)}`;

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    input: prompt
  });

  const text = extractText(response);
  const json = safeJsonParse(text);

  if (!json) {
    throw new Error('Model did not return valid JSON.');
  }

  return json;
}

function extractText(response) {
  if (response.output_text) return response.output_text;

  const parts = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function discoverOfficialWebsite(companyName, zipCode) {
  if (!process.env.SERPAPI_API_KEY) {
    return {
      url: null,
      note: 'SERPAPI_API_KEY not configured, website discovery limited.'
    };
  }

  const query = encodeURIComponent(`${companyName} ${zipCode} official website`);
  const url = `https://serpapi.com/search.json?engine=google&q=${query}&api_key=${process.env.SERPAPI_API_KEY}`;
  const data = await fetchJson(url);
  const best = (data?.organic_results || []).find((item) => isLikelyOfficialSite(item.link, companyName));

  return {
    url: best?.link || data?.organic_results?.[0]?.link || null,
    title: best?.title || data?.organic_results?.[0]?.title || null,
    source: 'serpapi',
    rawTopResults: (data?.organic_results || []).slice(0, 5).map((r) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet
    }))
  };
}

function isLikelyOfficialSite(link, companyName) {
  if (!link) return false;
  const normalized = link.toLowerCase();
  const banList = ['yelp.', 'facebook.', 'instagram.', 'linkedin.', 'mapquest.', 'tripadvisor.', 'bbb.org'];
  if (banList.some((x) => normalized.includes(x))) return false;

  const companyBits = companyName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  return companyBits.some((part) => part.length > 3 && normalized.includes(part));
}

async function inspectWebsite(siteUrl) {
  if (!siteUrl) {
    return { found: false, note: 'Official website not discovered.' };
  }

  try {
    const response = await fetch(siteUrl, {
      headers: { 'user-agent': 'Mozilla/5.0 AgencyEvaluator/1.0' },
      redirect: 'follow'
    });
    const html = await response.text();

    const title = matchTag(html, /<title>(.*?)<\/title>/is);
    const metaDescription = matchTag(html, /<meta[^>]+name=["']description["'][^>]+content=["'](.*?)["']/is)
      || matchTag(html, /<meta[^>]+content=["'](.*?)["'][^>]+name=["']description["']/is);
    const h1Matches = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gis)].map((m) => stripHtml(m[1])).filter(Boolean);
    const hasSchemaOrg = /application\/ld\+json/i.test(html) || /schema.org/i.test(html);
    const hasFaq = /FAQ|Frequently Asked Questions/i.test(html);
    const hasLocalBusinessSchema = /LocalBusiness|Restaurant|Dentist|Attorney|Store|MedicalClinic/i.test(html);
    const socialLinks = extractSocialLinks(html);
    const hasOpenGraph = /property=["']og:/i.test(html);
    const hasTwitterCards = /name=["']twitter:/i.test(html);

    return {
      found: true,
      finalUrl: response.url,
      status: response.status,
      title,
      metaDescription,
      h1s: h1Matches.slice(0, 3),
      hasSchemaOrg,
      hasFaq,
      hasLocalBusinessSchema,
      hasOpenGraph,
      hasTwitterCards,
      socialLinks
    };
  } catch (error) {
    return {
      found: false,
      note: `Website fetch failed: ${error.message}`
    };
  }
}

function matchTag(html, regex) {
  const match = html.match(regex);
  return match?.[1] ? stripHtml(match[1]).trim() : null;
}

function stripHtml(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractSocialLinks(html) {
  const patterns = [
    'facebook.com',
    'instagram.com',
    'linkedin.com',
    'x.com',
    'twitter.com',
    'youtube.com',
    'tiktok.com'
  ];

  const links = [];
  for (const pattern of patterns) {
    const regex = new RegExp(`https?:\\/\\/[^"'\\s>]*${pattern.replace('.', '\\.') }[^"'\\s>]*`, 'gi');
    const matches = html.match(regex) || [];
    for (const match of matches) {
      if (!links.includes(match)) links.push(match);
    }
  }
  return links;
}

async function getSearchSignals(companyName, zipCode) {
  if (!process.env.SERPAPI_API_KEY) {
    return { note: 'SERPAPI_API_KEY not configured.' };
  }

  const query = encodeURIComponent(`${companyName} ${zipCode}`);
  const url = `https://serpapi.com/search.json?engine=google&q=${query}&api_key=${process.env.SERPAPI_API_KEY}`;
  const data = await fetchJson(url);

  return {
    knowledgeGraph: data?.knowledge_graph || null,
    localResultsCount: data?.local_results?.places?.length || 0,
    topOrganicResults: (data?.organic_results || []).slice(0, 5).map((r) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet,
      position: r.position
    })),
    relatedQuestions: (data?.related_questions || []).slice(0, 5)
  };
}

async function getGoogleMapsSignals(companyName, zipCode) {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return { note: 'GOOGLE_PLACES_API_KEY not configured.' };
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.websiteUri,places.businessStatus,places.primaryTypeDisplayName'
    },
    body: JSON.stringify({ textQuery: `${companyName} ${zipCode}` })
  });

  if (!response.ok) {
    return { note: `Google Places lookup failed: ${response.status}` };
  }

  const data = await response.json();
  const place = data?.places?.[0];

  return {
    found: Boolean(place),
    place: place || null,
    alternatives: (data?.places || []).slice(0, 3).map((p) => ({
      name: p.displayName?.text,
      rating: p.rating,
      userRatingCount: p.userRatingCount,
      address: p.formattedAddress,
      websiteUri: p.websiteUri
    }))
  };
}

async function getYelpSignals(companyName, zipCode) {
  if (!process.env.YELP_API_KEY) {
    return { note: 'YELP_API_KEY not configured.' };
  }

  const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(companyName)}&location=${encodeURIComponent(zipCode)}&limit=3`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.YELP_API_KEY}`
    }
  });

  if (!response.ok) {
    return { note: `Yelp lookup failed: ${response.status}` };
  }

  const data = await response.json();
  const business = data?.businesses?.[0];

  return {
    found: Boolean(business),
    business: business
      ? {
          name: business.name,
          rating: business.rating,
          reviewCount: business.review_count,
          url: business.url,
          categories: business.categories?.map((c) => c.title) || [],
          location: business.location?.display_address || []
        }
      : null,
    alternatives: (data?.businesses || []).slice(0, 3).map((b) => ({
      name: b.name,
      rating: b.rating,
      reviewCount: b.review_count,
      url: b.url
    }))
  };
}

async function getSocialSignals(companyName, zipCode, websiteSocialLinks) {
  if (!process.env.SERPAPI_API_KEY) {
    return { note: 'SERPAPI_API_KEY not configured.' };
  }

  const queries = [
    `${companyName} ${zipCode} site:facebook.com`,
    `${companyName} ${zipCode} site:instagram.com`,
    `${companyName} ${zipCode} site:linkedin.com`,
    `${companyName} ${zipCode} site:tiktok.com`
  ];

  const results = [];
  for (const q of queries) {
    const data = await fetchJson(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&api_key=${process.env.SERPAPI_API_KEY}`);
    results.push({
      query: q,
      topResults: (data?.organic_results || []).slice(0, 3).map((r) => ({
        title: r.title,
        link: r.link,
        snippet: r.snippet
      }))
    });
  }

  return {
    websiteSocialLinks,
    searchResults: results
  };
}

function deriveAeoSignals({ websiteSignals, seoSignals, mapsSignals }) {
  return {
    hasStructuredData: Boolean(websiteSignals?.hasSchemaOrg),
    hasFaqContent: Boolean(websiteSignals?.hasFaq),
    hasLocalBusinessSchema: Boolean(websiteSignals?.hasLocalBusinessSchema),
    hasKnowledgeGraph: Boolean(seoSignals?.knowledgeGraph),
    hasRelatedQuestions: (seoSignals?.relatedQuestions || []).length > 0,
    hasMapEntity: Boolean(mapsSignals?.found)
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 AgencyEvaluator/1.0' }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json();
}


async function safely(fn, fallback) {
  try {
    return await fn();
  } catch (error) {
    return { ...fallback, error: error.message };
  }
}
