# Agency AI Employee

Node.js + HTML SPA starter for an "AI employee" with a Lead Search Agent.

## What it does

- Accepts a ZIP code from the SPA.
- Searches for local businesses.
- Returns a lead table with:
  - name
  - phone
  - address
  - business category
  - business size (estimated)
  - revenue (estimated)
- Uses OpenAI Responses API to normalize and enrich raw business data.

## Important limits

Phone, estimated size, and estimated revenue are not consistently available from a single public source.
This starter supports two modes:

1. **Mock mode** if `YELP_API_KEY` is missing.
2. **Live mode** using Yelp Business Search if `YELP_API_KEY` is present.

In live mode, `business_size` and `revenue_estimate` are AI estimates based on the business metadata returned by the provider. Treat them as directional, not authoritative.

## Setup

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000`

## Environment variables

- `OPENAI_API_KEY` - required
- `OPENAI_MODEL` - optional, defaults to `gpt-5.4`
- `PORT` - optional, defaults to `3000`
- `YELP_API_KEY` - optional, enables live business search

## Architecture

- `public/index.html` - SPA UI
- `src/server.js` - Express API and static file server
- `src/yelpProvider.js` - Yelp provider adapter
- `src/mockProvider.js` - Mock local businesses fallback
- `src/openaiEnrichment.js` - Lead normalization and estimation via OpenAI

## API

### `POST /api/lead-search`

Request:

```json
{ "zipCode": "10001" }
```

Response:

```json
{
  "zipCode": "10001",
  "source": "mock",
  "count": 3,
  "leads": [
    {
      "name": "Chelsea Family Dental",
      "phone": "+1 212-555-0101",
      "address": "112 W 25th St, New York, NY 10001",
      "business_category": "Dental Clinic",
      "business_size": "small",
      "revenue_estimate": "$500K-$2M",
      "website": "https://example.com",
      "notes": "Estimated from category and local footprint."
    }
  ]
}
```
