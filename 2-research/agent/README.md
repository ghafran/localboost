# Agency AI Employee

A Node.js + HTML SPA that evaluates a local company's online presence.

## What it does

Input:
- Company name
- Zip code

Output:
- Overall score
- Category scorecards for:
  - SEO
  - AEO
  - Google Maps / local presence
  - Yelp
  - Social presence
  - Website quality
- Improvement notes for each category

## Stack

- Node.js + Express
- Plain HTML/CSS/JS SPA
- OpenAI API for score synthesis
- Optional external providers for data collection:
  - SerpAPI for Google search results
  - Google Places API for Maps presence
  - Yelp Fusion API for Yelp presence

## Important limitation

OpenAI alone cannot directly and reliably inspect Google Maps, Yelp, or live search results. This project uses OpenAI to reason over signals collected from third-party APIs. If you omit those provider keys, the app still runs, but the report will be more limited.

## Setup

1. Copy env file:

```bash
cp .env.example .env
```

2. Fill in your API keys.

3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm start
```

5. Open:

```text
http://localhost:3000
```

## API

### POST /api/evaluate

Body:

```json
{
  "companyName": "Acme Dental",
  "zipCode": "10001"
}
```

## Suggested next upgrades

- Add PageSpeed Insights API for performance scoring
- Add GBP category completeness checks
- Save evaluations to SQLite/Postgres
- Add PDF export for agency reports
- Add lead CRM notes and follow-up generation
- Add queueing and background jobs for bulk audits
