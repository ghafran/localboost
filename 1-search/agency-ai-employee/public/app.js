const zipInput = document.getElementById("zip");
const pageSizeSelect = document.getElementById("pageSize");
const searchBtn = document.getElementById("searchBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const prevBtnBottom = document.getElementById("prevBtnBottom");
const nextBtnBottom = document.getElementById("nextBtnBottom");
const pageInfo = document.getElementById("pageInfo");
const pageInfoBottom = document.getElementById("pageInfoBottom");
const summary = document.getElementById("summary");
const resultsBody = document.getElementById("resultsBody");
const loading = document.getElementById("loading");
const errorBox = document.getElementById("error");

const state = {
  zip: "",
  page: 1,
  pageSize: Number(pageSizeSelect.value),
  paging: null
};

function setLoading(isLoading) {
  loading.classList.toggle("hidden", !isLoading);
  searchBtn.disabled = isLoading;
  prevBtn.disabled = true;
  nextBtn.disabled = true;
  prevBtnBottom.disabled = true;
  nextBtnBottom.disabled = true;
}

function setError(message = "") {
  errorBox.textContent = message;
  errorBox.classList.toggle("hidden", !message);
}

function renderRows(businesses) {
  resultsBody.innerHTML = "";
  if (!businesses.length) {
    resultsBody.innerHTML = `<tr><td colspan="6" class="empty">No businesses found.</td></tr>`;
    return;
  }

  for (const biz of businesses) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(biz.name)}</td>
      <td>${escapeHtml(biz.phone)}</td>
      <td>${escapeHtml(biz.address)}</td>
      <td>${escapeHtml(biz.businessCategory)}</td>
      <td>${escapeHtml(biz.businessSize)}</td>
      <td>${escapeHtml(biz.revenueEstimate)}</td>
    `;
    resultsBody.appendChild(tr);
  }
}

function updatePagingUi(paging) {
  if (!paging) return;
  const text = `Page ${paging.page} of ${paging.totalPages}`;
  pageInfo.textContent = text;
  pageInfoBottom.textContent = text;
  prevBtn.disabled = !paging.hasPreviousPage;
  prevBtnBottom.disabled = !paging.hasPreviousPage;
  nextBtn.disabled = !paging.hasNextPage;
  nextBtnBottom.disabled = !paging.hasNextPage;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadPage(page) {
  setError("");
  setLoading(true);

  try {
    state.page = page;
    state.pageSize = Number(pageSizeSelect.value);
    const response = await fetch("/api/agents/lead-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        zip: state.zip,
        page: state.page,
        pageSize: state.pageSize
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");

    state.paging = data.paging;
    renderRows(data.businesses);
    updatePagingUi(data.paging);

    const startItem = (data.paging.page - 1) * data.paging.pageSize + 1;
    const endItem = Math.min(startItem + data.businesses.length - 1, data.paging.total);
    summary.textContent = `${data.paging.total} businesses found for ZIP ${data.zip}. Showing ${startItem}-${endItem}.`;
  } catch (error) {
    renderRows([]);
    pageInfo.textContent = "Page 0 of 0";
    pageInfoBottom.textContent = "Page 0 of 0";
    summary.textContent = "Search failed.";
    setError(error.message);
  } finally {
    setLoading(false);
    if (state.paging) updatePagingUi(state.paging);
  }
}

function startSearch() {
  const zip = zipInput.value.trim();
  if (!/^\d{5}$/.test(zip)) {
    setError("Enter a valid 5-digit ZIP code.");
    return;
  }
  state.zip = zip;
  loadPage(1);
}

searchBtn.addEventListener("click", startSearch);
zipInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") startSearch();
});
pageSizeSelect.addEventListener("change", () => {
  if (state.zip) loadPage(1);
});

for (const button of [prevBtn, prevBtnBottom]) {
  button.addEventListener("click", () => {
    if (state.paging?.hasPreviousPage) loadPage(state.paging.page - 1);
  });
}

for (const button of [nextBtn, nextBtnBottom]) {
  button.addEventListener("click", () => {
    if (state.paging?.hasNextPage) loadPage(state.paging.page + 1);
  });
}
