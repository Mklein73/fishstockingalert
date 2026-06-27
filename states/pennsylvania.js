/**
 * Pennsylvania fish stocking data — COMING SOON
 *
 * To add Pennsylvania support:
 *  1. Find PA's public stocking data API (e.g. PA Fish & Boat Commission)
 *  2. Write a fetchPage() function that calls it
 *  3. Map the raw field names to: { waterName, county, species, dateStocked }
 *  4. Replace the placeholder fetchData() below with the real one
 *  5. Update sourceLabel and sourceUrl to point to the PA data source
 */
window.PennsylvaniaState = (function () {

  async function fetchData() {
    throw new Error("Pennsylvania stocking data is not yet connected. Check back soon!");
  }

  return {
    name:        "Pennsylvania",
    sourceLabel: "PA Fish & Boat Commission (coming soon)",
    sourceUrl:   "https://www.fishandboat.com",
    fetchData:   fetchData
  };

})();
