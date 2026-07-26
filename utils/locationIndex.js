const fs = require("fs");
const path = require("path");
const DATA_PATH = path.join('./india_hierarchy.json');

function normalize(name) {
    return name
        .toLowerCase()
        .replace(/\(ct\)/g, "")
        .replace(/\[\d+\]/g, "")
        .replace(/^\d+\s*/, "")
        .replace(/[^a-z\s]/g, "")
        .trim()
        .replace(/\s+/g, " ");
}

function buildIndex() {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const hierarchy = JSON.parse(raw);
    const index = new Map();

    const setIfAbsent = (key, districtName) => {
        const normalized = normalize(key);
        if (normalized && !index.has(normalized)) {
            index.set(normalized, districtName);
        }
    }

    for (const stateNode of Object.values(hierarchy)) {
        const districts = stateNode.districts || {};

        for (const [districtName, subDistricts] of Object.entries(districts)) {
            setIfAbsent(districtName, districtName);

            for (const [subDistrictName, villages] of Object.entries(subDistricts)) {
                setIfAbsent(subDistrictName, districtName);

                for (const village of villages) {
                    setIfAbsent(village.name, districtName);
                }
            }
        }
    }

    return index;
}

let cityToDistrict;
try {
    cityToDistrict = buildIndex();
    console.log(`[locationIndex] Loaded ${cityToDistrict.size} place -> district mappings`);
} catch (err) {
    console.error(`[locationIndex] Failed to build index: ${err.message}`);
    cityToDistrict = new Map();
}

function resolveDistrictFromJSON(city) {
    const key = normalize(city);
    return cityToDistrict.get(key) || null;
}

module.exports = { resolveDistrictFromJSON, normalize };