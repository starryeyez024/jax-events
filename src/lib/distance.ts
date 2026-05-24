// City-based distance buckets relative to your home in Jacksonville Beach, FL.
//
// We don't have lat/lon for every event upstream — most sources only give a
// city name (or sometimes nothing). So we classify cities into 4 buckets and
// apply a flat penalty per bucket. For cities we DO have rough lat/lon for,
// we also compute an approximate driving distance + time from your home.

export type DistanceBucket = "local" | "nearby" | "drive" | "far";

export const BUCKET_LABELS: Record<DistanceBucket, string> = {
  local: "Local (Jax metro)",
  nearby: "Nearby (≤ ~1 hr)",
  drive: "Drive (~1–3 hr)",
  far: "Far (3+ hr)",
};

export const BUCKET_ORDER: DistanceBucket[] = ["local", "nearby", "drive", "far"];

const BASE_PENALTY: Record<DistanceBucket, number> = {
  local: 0,
  nearby: -3,
  drive: -15,
  far: -30,
};

function sourceModifier(source: string): number {
  if (source.startsWith("meetup:")) return 1.5;
  if (source === "verified") return 0.8;
  if (source === "florida-theatre") return 0.7;
  if (source === "ticketmaster") return 0.8;
  return 1.0;
}

const NORM = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,]/g, "");

// City → approximate (lat, lon). Coordinates are city-center, not the actual
// venue, so distance numbers are best-effort estimates (±a few miles).
const CITY_COORDS: Record<string, [number, number]> = {
  "jacksonville beach": [30.2946, -81.3931],
  "jax beach": [30.2946, -81.3931],
  "atlantic beach": [30.3349, -81.3984],
  "neptune beach": [30.3138, -81.3934],
  "ponte vedra beach": [30.2398, -81.3855],
  "ponte vedra": [30.2398, -81.3855],
  mayport: [30.395, -81.4123],
  jacksonville: [30.3322, -81.6557],
  jax: [30.3322, -81.6557],
  riverside: [30.3206, -81.6764],
  "san marco": [30.3133, -81.6624],
  "st augustine": [29.9012, -81.3124],
  "saint augustine": [29.9012, -81.3124],
  "st augustine beach": [29.8497, -81.2723],
  "fernandina beach": [30.6697, -81.4623],
  "amelia island": [30.6224, -81.4541],
  yulee: [30.6293, -81.6065],
  "orange park": [30.166, -81.7064],
  "fleming island": [30.1066, -81.7193],
  middleburg: [30.0727, -81.8628],
  "green cove springs": [29.9919, -81.6781],
  callahan: [30.5618, -81.831],
  hilliard: [30.6886, -81.9173],
  "daytona beach": [29.2108, -81.0228],
  daytona: [29.2108, -81.0228],
  "ormond beach": [29.2858, -81.0559],
  "palm coast": [29.5849, -81.2078],
  gainesville: [29.6516, -82.3248],
  ocala: [29.1872, -82.1401],
  brunswick: [31.1499, -81.4915],
  "jekyll island": [31.0696, -81.4259],
  "st simons": [31.1502, -81.3915],
  "st simons island": [31.1502, -81.3915],
  "saint simons": [31.1502, -81.3915],
  kingsland: [30.7989, -81.6907],
  "lake city": [30.1897, -82.6393],
  starke: [29.9441, -82.1098],
  palatka: [29.6483, -81.6376],
  orlando: [28.5384, -81.3789],
  "winter park": [28.6, -81.34],
  kissimmee: [28.2916, -81.4076],
  tampa: [27.9506, -82.4572],
  "st petersburg": [27.7676, -82.6403],
  "saint petersburg": [27.7676, -82.6403],
  clearwater: [27.9659, -82.8001],
  sarasota: [27.3364, -82.5307],
  "fort lauderdale": [26.1224, -80.1373],
  "ft lauderdale": [26.1224, -80.1373],
  miami: [25.7617, -80.1918],
  "deerfield beach": [26.3184, -80.0998],
  deerfield: [26.3184, -80.0998],
  "boca raton": [26.3683, -80.1289],
  "west palm beach": [26.7153, -80.0534],
  pensacola: [30.4213, -87.2169],
  tallahassee: [30.4383, -84.2807],
};

const LOCAL_CITIES = [
  "jacksonville",
  "jacksonville beach",
  "jax beach",
  "atlantic beach",
  "neptune beach",
  "ponte vedra",
  "ponte vedra beach",
  "mayport",
  "san marco",
  "riverside",
  "jax",
].map(NORM);

const NEARBY_CITIES = [
  "st augustine",
  "saint augustine",
  "st augustine beach",
  "fernandina beach",
  "amelia island",
  "yulee",
  "orange park",
  "fleming island",
  "middleburg",
  "green cove springs",
  "callahan",
  "hilliard",
].map(NORM);

const DRIVE_CITIES = [
  "daytona beach",
  "daytona",
  "ormond beach",
  "palm coast",
  "gainesville",
  "ocala",
  "brunswick",
  "jekyll island",
  "st simons",
  "st simons island",
  "saint simons",
  "kingsland",
  "lake city",
  "starke",
  "palatka",
].map(NORM);

const FAR_CITIES = [
  "orlando",
  "winter park",
  "kissimmee",
  "tampa",
  "st petersburg",
  "saint petersburg",
  "clearwater",
  "sarasota",
  "fort lauderdale",
  "ft lauderdale",
  "miami",
  "deerfield beach",
  "deerfield",
  "boca raton",
  "west palm beach",
  "pensacola",
  "tallahassee",
].map(NORM);

const LOCAL = new Set(LOCAL_CITIES);
const NEARBY = new Set(NEARBY_CITIES);
const DRIVE = new Set(DRIVE_CITIES);
const FAR = new Set(FAR_CITIES);

export function bucketFor(
  city: string | null | undefined,
  haystack?: string | null
): DistanceBucket {
  if (city) {
    const c = NORM(city);
    if (LOCAL.has(c)) return "local";
    if (NEARBY.has(c)) return "nearby";
    if (DRIVE.has(c)) return "drive";
    if (FAR.has(c)) return "far";
  }
  if (haystack) {
    const h = NORM(haystack);
    for (const c of FAR) if (h.includes(c)) return "far";
    for (const c of LOCAL) if (h.includes(c)) return "local";
    for (const c of NEARBY) if (h.includes(c)) return "nearby";
    for (const c of DRIVE) if (h.includes(c)) return "drive";
  }
  return "far";
}

export function distancePenalty(
  city: string | null | undefined,
  source: string,
  haystack?: string | null
): { bucket: DistanceBucket; penalty: number } {
  const bucket = bucketFor(city, haystack);
  const penalty = Math.round(BASE_PENALTY[bucket] * sourceModifier(source));
  return { bucket, penalty };
}

export function bucketsUpTo(b: DistanceBucket): DistanceBucket[] {
  const idx = BUCKET_ORDER.indexOf(b);
  return BUCKET_ORDER.slice(0, idx + 1);
}

// ----- Driving-distance estimate -----
//
// We compute great-circle (haversine) distance from your home, then apply
// a road-curvature multiplier and average highway speed to estimate drive
// time. This is intentionally approximate — for exact ETA, click through
// the Google Maps link on the card.

const HOME_LAT = Number(process.env.HOME_LAT ?? 30.2867); // 915 8th Ave S, Jax Beach
const HOME_LON = Number(process.env.HOME_LON ?? -81.3934);
const KM_PER_MILE = 1.60934;
const EARTH_RADIUS_KM = 6371;
const ROAD_FACTOR = 1.25;        // routes aren't straight lines
const SHORT_BIAS_MIN = 2;        // surface streets / parking
const AVG_SPEED_MPH = 45;        // mix of city + highway

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(Math.min(1, Math.sqrt(a))));
  const km = 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a))); // simpler form
  void c; // unused, but kept for reviewer clarity
  return km / KM_PER_MILE;
}

export type DriveEstimate = {
  miles: number;       // estimated road miles
  minutes: number;     // estimated minutes
  precise: boolean;    // true if we used event lat/lon, false if city-center only
} | null;

export function estimateDrive(
  eventLat: number | null | undefined,
  eventLon: number | null | undefined,
  city: string | null | undefined,
  haystack?: string | null
): DriveEstimate {
  let lat: number | null = null;
  let lon: number | null = null;
  let precise = false;

  if (typeof eventLat === "number" && typeof eventLon === "number") {
    lat = eventLat;
    lon = eventLon;
    precise = true;
  } else {
    const c = resolveCity(city, haystack);
    if (!c) return null;
    const coords = CITY_COORDS[NORM(c)];
    if (!coords) return null;
    lat = coords[0];
    lon = coords[1];
  }

  const straight = haversineMiles(HOME_LAT, HOME_LON, lat, lon);
  const miles = Math.round(straight * ROAD_FACTOR);
  const minutes = Math.max(
    1,
    Math.round((miles / AVG_SPEED_MPH) * 60 + SHORT_BIAS_MIN)
  );
  return { miles, minutes, precise };
}

function resolveCity(
  city: string | null | undefined,
  haystack?: string | null
): string | null {
  if (city) {
    const c = NORM(city);
    if (c in CITY_COORDS) return c;
  }
  if (haystack) {
    const h = NORM(haystack);
    for (const c of Object.keys(CITY_COORDS)) {
      if (h.includes(c)) return c;
    }
  }
  return null;
}

// ----- Google Maps deep links -----

export function mapLinkForAddress(parts: Array<string | null | undefined>): string | null {
  const text = parts.filter(Boolean).join(", ").trim();
  if (!text) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

export function directionsLink(parts: Array<string | null | undefined>): string | null {
  const text = parts.filter(Boolean).join(", ").trim();
  if (!text) return null;
  const origin = encodeURIComponent("915 8th Ave S, Jacksonville Beach, FL 32250");
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${encodeURIComponent(
    text
  )}&travelmode=driving`;
}
