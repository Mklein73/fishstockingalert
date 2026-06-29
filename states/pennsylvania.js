/**
 * Pennsylvania fish stocking data
 * Source: PA Fish & Boat Commission — PFBC ArcGIS Portal (public, no API key)
 * https://fbweb.pa.gov/arcgis/rest/services/PFBC_Map_Services/TroutStockedSections_2026/
 *
 * NOTE: fbweb.pa.gov does not send CORS headers, so browser-side fetches are blocked.
 * The full 2026 dataset is pre-fetched and served as /data/pa-stocking-2026.json
 * (same-origin, no CORS restrictions). Refresh that file from the PFBC API as needed.
 *
 * fetchData() returns an array of normalized records:
 *   { waterName, county, species, dateStocked, lat, lon, fishCount, ...paExtras }
 * All state fetchers must return the same shape so the rest of the app
 * works identically regardless of which state is active.
 *
 * PA data is a pre-season annual stocking allocation (not individual events).
 * Records are stocking sections; each section may contain multiple species.
 * dateStocked is null — no per-event dates are available in this dataset.
 */
window.PennsylvaniaState = (function () {

  var DATA_URL = "data/pa-stocking-2026.json";

  function _primarySpecies(r) {
    var candidates = [
      { name: "Rainbow Trout",        count: r.TotalRainbowStocked || 0 },
      { name: "Brown Trout",          count: r.TotalBrownStocked   || 0 },
      { name: "Brook Trout",          count: r.TotalBrookStocked   || 0 },
      { name: "Golden Rainbow Trout", count: r.TotalGoldenStocked  || 0 },
      { name: "Brood Trout",          count: r.TotalBroodStocked   || 0 }
    ].filter(function (c) { return c.count > 0; });

    if (candidates.length === 0) return "Trout";
    candidates.sort(function (a, b) { return b.count - a.count; });
    return candidates[0].name;
  }

  async function fetchData() {
    var res = await fetch(DATA_URL);
    if (!res.ok) throw new Error("HTTP " + res.status + " loading PA stocking data");
    var rawRecords = await res.json();

    /* PA bounding box — drops the two PFBC records with corrupted longitude values */
    var PA_LAT = [39.7, 42.3];
    var PA_LON = [-80.6, -74.7];

    return rawRecords.map(function (r) {
      var lat = (r.Mid_Lat  && r.Mid_Lat  !== 0) ? r.Mid_Lat  : (r.WtrLatDD || null);
      var lon = (r.Mid_Long && r.Mid_Long !== 0) ? r.Mid_Long : (r.WtrLonDD || null);

      var totalFish = (r.TotalAdultStocked_minusBrood || 0) + (r.TotalBroodStocked || 0);
      var lengthMi  = (r.Length_MI_ && r.Length_MI_ > 0) ? r.Length_MI_ : null;
      var fpm       = (totalFish > 0 && lengthMi > 0) ? totalFish / lengthMi : null;

      var speciesList = [];
      if (r.TotalRainbowStocked > 0) speciesList.push({ name: "Rainbow Trout",        count: r.TotalRainbowStocked });
      if (r.TotalBrownStocked   > 0) speciesList.push({ name: "Brown Trout",          count: r.TotalBrownStocked   });
      if (r.TotalBrookStocked   > 0) speciesList.push({ name: "Brook Trout",          count: r.TotalBrookStocked   });
      if (r.TotalGoldenStocked  > 0) speciesList.push({ name: "Golden Rainbow Trout", count: r.TotalGoldenStocked  });
      if (r.TotalBroodStocked   > 0) speciesList.push({ name: "Brood Trout",          count: r.TotalBroodStocked   });
      speciesList.sort(function (a, b) { return b.count - a.count; });

      return {
        /* ── Standard fields shared with all states ───────────── */
        waterName:   r.WtrName || "",
        county:      r.County  || "",
        species:     _primarySpecies(r),
        dateStocked: null,        /* pre-season allocation — no per-event dates */
        lat:         lat,
        lon:         lon,
        fishCount:   totalFish || null,   /* maps to "plant size" metric card */

        /* ── PA-specific extras (read by detail panel) ────────── */
        sectionLengthMiles: lengthMi,
        fishPerMile:        fpm ? Math.round(fpm) : null,
        bestFishingWater:   r.Best_Fishing_Wtr === "Y",
        specialRegulations: r.SpecReg === "Y",
        regulationName:     r.Reg_Name   || null,
        regulationLink:     r.Reg_Link   || null,
        description:        r.Description || null,
        speciesList:        speciesList,
        totalRainbow:       r.TotalRainbowStocked || 0,
        totalBrown:         r.TotalBrownStocked   || 0,
        totalBrook:         r.TotalBrookStocked   || 0,
        totalGolden:        r.TotalGoldenStocked  || 0,
        totalBrood:         r.TotalBroodStocked   || 0,
        stockingYear:       r.StockingYear || 2026
      };
    }).filter(function (rec) {
      return rec.lat !== null && rec.lon !== null
        && rec.lat >= PA_LAT[0] && rec.lat <= PA_LAT[1]
        && rec.lon >= PA_LON[0] && rec.lon <= PA_LON[1];
    });
  }

  return {
    name:        "Pennsylvania",
    sourceLabel: "PA Fish & Boat Commission (PFBC) ArcGIS Portal",
    sourceUrl:   "https://www.fishandboat.com",
    fetchData:   fetchData
  };

})();
