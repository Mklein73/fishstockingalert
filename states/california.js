/**
 * California fish stocking data
 * Source: CA Dept. of Fish & Wildlife — CDFW Open Data Portal (public, no API key)
 * https://data-cdfw.opendata.arcgis.com/datasets/CDFW::planting-location-cdfw-ds2897
 *
 * fetchData() returns an array of normalized records:
 *   { waterName, county, species, dateStocked }
 * All state fetchers must return the same shape so the rest of the app
 * works identically regardless of which state is active.
 */
window.CaliforniaState = (function () {

  const API_BASE  = "https://services2.arcgis.com/Uq9r85Potqm3MfRV/arcgis/rest/services/biosds2897_fmu/FeatureServer/0/query";
  const FIELDS    = "WaterName,Counties,FishType,WeekOfPlantStart,Lat,Lon";
  const PAGE_SIZE = 1000;

  // Fetch one page of results from the CDFW API
  async function fetchPage(offset) {
    const url = API_BASE
      + "?where=1%3D1"
      + "&outFields=" + FIELDS
      + "&orderByFields=WeekOfPlantStart+DESC"
      + "&resultOffset=" + offset
      + "&resultRecordCount=" + PAGE_SIZE
      + "&f=json";

    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.features.map(function (f) { return f.attributes; });
  }

  // Fetch ALL pages, then normalize the raw CDFW field names into
  // the standard shape used throughout the app
  async function fetchData() {
    const firstPage = await fetchPage(0);
    var rawRecords = firstPage;

    if (firstPage.length === PAGE_SIZE) {
      // More pages exist — find out how many then fetch them all at once
      const countRes  = await fetch(API_BASE + "?where=1%3D1&returnCountOnly=true&f=json");
      const countData = await countRes.json();
      const total     = countData.count || 0;

      var pagePromises = [];
      for (var offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
        pagePromises.push(fetchPage(offset));
      }
      var extraPages = await Promise.all(pagePromises);
      extraPages.forEach(function (page) {
        rawRecords = rawRecords.concat(page);
      });
    }

    // Normalize: translate CDFW-specific field names → standard app field names
    return rawRecords.map(function (r) {
      return {
        waterName:   r.WaterName          || "",
        county:      r.Counties           || "",
        species:     r.FishType           || "",
        dateStocked: r.WeekOfPlantStart   || "",
        lat:         r.Lat                || null,
        lon:         r.Lon                || null
      };
    });
  }

  return {
    name:        "California",
    sourceLabel: "CDFW Open Data Portal",
    sourceUrl:   "https://data-cdfw.opendata.arcgis.com/datasets/CDFW::planting-location-cdfw-ds2897",
    fetchData:   fetchData
  };

})();
