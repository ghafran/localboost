export async function searchBusinessesByZipYelp(zipCode, apiKey) {
  const url = new URL("https://api.yelp.com/v3/businesses/search");
  url.searchParams.set("location", zipCode);
  url.searchParams.set("limit", "10");
  url.searchParams.set("sort_by", "best_match");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Yelp request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return (data.businesses || []).map((b) => ({
    name: b.name || "",
    phone: b.display_phone || b.phone || "",
    address: [
      ...(b.location?.display_address || [])
    ].join(", "),
    category: (b.categories || []).map((c) => c.title).join(", "),
    website: b.url || "",
    reviewCount: b.review_count || 0,
    rating: b.rating || null,
    coordinates: b.coordinates || null,
    raw: b
  }));
}
