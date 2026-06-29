/**
 * Pennsylvania fish stocking data
 * Source: PA Fish & Boat Commission (PFBC)
 *   Allocation: data/pa-stocking-2026.json  (pre-fetched from PFBC ArcGIS, no CORS issue)
 *   Schedule:   data/pa-schedule-2026.json  (pre-fetched from fbweb.pa.gov/TroutStocking)
 *
 * fetchData() returns an array of normalized records identical in shape to
 * other state adapters so app.js and ui.js work unchanged.
 *
 * Each stream section record carries:
 *   scheduledDates  [{date, dateIsApproximate, species}] — all PFBC-scheduled events
 *   dateStocked     ISO string — next upcoming date, or most recent past date if none upcoming
 *   dateIsApproximate  boolean — true when dateStocked came from a "WeekOf" schedule entry
 *
 * Lakes (secNum=0 in the schedule) are excluded from the join and carry
 * empty scheduledDates. dateStocked remains null for them.
 *
 * Re-run scripts/fetch-pa-schedule.py at the start of each stocking season
 * to refresh the schedule file without touching this adapter.
 */
window.PennsylvaniaState = (function () {

  var DATA_URL     = "data/pa-stocking-2026.json";
  var SCHEDULE_URL = "data/pa-schedule-2026.json";

  /* PA bounding box — drops the two PFBC records with corrupted longitude values */
  var PA_LAT = [39.7, 42.3];
  var PA_LON = [-80.6, -74.7];

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
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var todayISO = today.toISOString().slice(0, 10);

    var results = await Promise.all([
      fetch(DATA_URL),
      fetch(SCHEDULE_URL)
    ]);

    if (!results[0].ok) throw new Error("HTTP " + results[0].status + " loading PA stocking data");
    if (!results[1].ok) throw new Error("HTTP " + results[1].status + " loading PA stocking schedule");

    var rawRecords  = await results[0].json();
    var schedRecords = await results[1].json();

    /* Build join map: "WtrName|SecNum" -> sorted [{date, dateIsApproximate, species}] */
    var schedMap = {};
    schedRecords.forEach(function (s) {
      if (!s.secNum || s.secNum <= 0) return;   /* streams only; skip lake secNum=0 */
      var key = (s.waterName || "") + "|" + s.secNum;
      if (!schedMap[key]) schedMap[key] = [];
      schedMap[key].push({
        date:              s.date,
        dateIsApproximate: !!s.dateIsApproximate,
        species:           s.species || null
      });
    });
    Object.keys(schedMap).forEach(function (k) {
      schedMap[k].sort(function (a, b) { return a.date > b.date ? 1 : a.date < b.date ? -1 : 0; });
    });

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

      /* Join schedule on WtrName + SecNum (streams only) */
      var schedKey       = (r.WtrName || "") + "|" + (r.SecNum || 0);
      var scheduledDates = schedMap[schedKey] || [];

      /* Primary date: next upcoming, falling back to most recent past */
      var upcoming = scheduledDates.filter(function (s) { return s.date >= todayISO; });
      var past     = scheduledDates.filter(function (s) { return s.date <  todayISO; });
      var primaryEntry = upcoming.length > 0 ? upcoming[0]
                       : past.length    > 0 ? past[past.length - 1]
                       : null;
      var dateStocked      = primaryEntry ? primaryEntry.date : null;
      var dateIsApproximate = primaryEntry ? primaryEntry.dateIsApproximate : false;

      return {
        /* Standard fields shared across all state adapters */
        waterName:        r.WtrName || "",
        county:           r.County  || "",
        species:          _primarySpecies(r),
        dateStocked:      dateStocked,
        dateIsApproximate: dateIsApproximate,
        lat:              lat,
        lon:              lon,
        fishCount:        totalFish || null,

        /* PA-specific extras read by detail panel and metric bars */
        sectionLengthMiles: lengthMi,
        fishPerMile:        fpm ? Math.round(fpm) : null,
        bestFishingWater:   r.Best_Fishing_Wtr === "Y",
        specialRegulations: r.SpecReg === "Y",
        regulationName:     r.Reg_Name   || null,
        regulationLink:     r.Reg_Link   || null,
        description:        r.Description || null,
        speciesList:        speciesList,
        scheduledDates:     scheduledDates,
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
    sourceLabel: "PA Fish & Boat Commission (PFBC)",
    sourceUrl:   "https://www.fishandboat.com",
    fetchData:   fetchData
  };

})();
