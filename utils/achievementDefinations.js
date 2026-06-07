/**
 * MOTONOMAAD — Achievement Loader
 * ────────────────────────────────
 * Reads achievement definitions from achievements.json.
 * To add/edit/remove achievements, only touch that file — not this one.
 */

const { achievements: ACHIEVEMENTS } = require("./Achievements.json");

const ACHIEVEMENT_TYPES = {
  DISTANCE:       "distance",
  ITINERARY:      "itinerary",
  RIDES:          "rides",
  STATES_VISITED: "states_visited",
  STREAK:         "streak",
  NIGHT_RIDE:     "night_ride",
  ELEVATION:      "elevation",
  FUEL_STOPS:     "fuel_stops",
  COMMUNITY:      "community",
  PROFILE:        "profile",
};

const getById   = (id)   => ACHIEVEMENTS.find((a) => a.id === id);
const getByType = (type) => ACHIEVEMENTS.filter((a) => a.type === type);

module.exports = { ACHIEVEMENTS, ACHIEVEMENT_TYPES, getById, getByType };