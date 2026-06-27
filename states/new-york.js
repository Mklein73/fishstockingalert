/**
 * New York fish stocking data — COMING SOON
 *
 * To add New York support:
 *  1. Find NY's public stocking data API (e.g. NY Dept. of Environmental Conservation)
 *  2. Write a fetchPage() function that calls it
 *  3. Map the raw field names to: { waterName, county, species, dateStocked }
 *  4. Replace the placeholder fetchData() below with the real one
 *  5. Update sourceLabel and sourceUrl to point to the NY data source
 */
window.NewYorkState = (function () {

  async function fetchData() {
    throw new Error("New York stocking data is not yet connected. Check back soon!");
  }

  return {
    name:        "New York",
    sourceLabel: "NY Dept. of Environmental Conservation (coming soon)",
    sourceUrl:   "https://www.dec.ny.gov",
    fetchData:   fetchData
  };

})();
