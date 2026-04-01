const MOCK_BY_ZIP = {
  "10001": [
    {
      name: "Chelsea Family Dental",
      phone: "+1 212-555-0101",
      address: "112 W 25th St, New York, NY 10001",
      category: "Dental Clinic",
      website: "https://chelseafamilydental.example"
    },
    {
      name: "Hudson Print & Signs",
      phone: "+1 212-555-0102",
      address: "248 W 30th St, New York, NY 10001",
      category: "Print Shop",
      website: "https://hudsonprint.example"
    },
    {
      name: "Empire HVAC Services",
      phone: "+1 212-555-0103",
      address: "390 8th Ave, New York, NY 10001",
      category: "HVAC Contractor",
      website: "https://empirehvac.example"
    }
  ]
};

export async function searchBusinessesByZip(zipCode) {
  return MOCK_BY_ZIP[zipCode] ?? [
    {
      name: `Sample Business for ${zipCode}`,
      phone: "",
      address: `${zipCode}, USA`,
      category: "Local Business",
      website: ""
    }
  ];
}
