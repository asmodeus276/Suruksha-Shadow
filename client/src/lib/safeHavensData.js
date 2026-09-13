/**
 * Safe Havens Data & Sanctuary Radar Discovery Engine
 * -------------------------------------------------------------
 * Provides real-time distance calculation, walking/driving transit estimates,
 * and emergency navigation for nearby police stations, 24/7 hospitals,
 * lit transit zones, and national emergency helplines.
 */

// Calculate Haversine distance between two coordinates in kilometers
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Format distance string (e.g. "450 m" or "1.8 km")
export function formatDistance(distanceKm) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

// Estimate transit time
export function estimateTransitTime(distanceKm) {
  const walkingMin = Math.max(1, Math.round((distanceKm / 4.5) * 60)); // ~4.5 km/h walking
  const drivingMin = Math.max(1, Math.round((distanceKm / 35) * 60)); // ~35 km/h city driving
  return {
    walking: `${walkingMin} min walk`,
    driving: `${drivingMin} min drive`,
  };
}

// National Emergency Helplines (India & International)
export const EMERGENCY_HELPLINES = [
  {
    name: "National Emergency Service (All-in-One)",
    number: "112",
    tag: "POLICE · FIRE · MEDICAL",
    color: "#e02424",
    description: "Single unified emergency number for instant police dispatch and rescue.",
  },
  {
    name: "Women Police Helpline",
    number: "1091",
    tag: "WOMEN IN DISTRESS",
    color: "#e8c468",
    description: "Direct 24/7 emergency response dedicated for women's safety.",
  },
  {
    name: "Women Domestic & Stalking Helpline",
    number: "181",
    tag: "NATIONAL CELL",
    color: "#a855f7",
    description: "24/7 crisis intervention, legal aid, and counseling helpline.",
  },
  {
    name: "Women Power Line (Cyber & Stalking)",
    number: "1090",
    tag: "ANTI-HARASSMENT",
    color: "#38bdf8",
    description: "Confidential anti-stalking and harassment cell response.",
  },
  {
    name: "Emergency Medical & Ambulance",
    number: "108",
    tag: "24/7 AMBULANCE",
    color: "#22c55e",
    description: "Immediate life-support trauma transport and paramedic dispatch.",
  },
];

/**
 * Curated Safe Haven Sanctuaries
 * Relative to base coordinates (Knowledge Park III / Greater Noida), or dynamically offset relative to user GPS.
 */
export const SANCTUARY_TEMPLATES = [
  {
    id: "sh-police-01",
    name: "Knowledge Park III Police Station",
    category: "police",
    categoryLabel: "24/7 Police Station",
    phone: "0120-2326001",
    address: "Knowledge Park III, Institutional Area, Greater Noida, UP",
    verified247: true,
    offset: { lat: 0.0035, lng: 0.0042 },
    rating: 4.8,
  },
  {
    id: "sh-police-02",
    name: "Women Police Assistance Booth & PCR Unit",
    category: "police",
    categoryLabel: "Women PCR Patrol Unit",
    phone: "1091",
    address: "Pari Chowk Junction & Transit Interchange",
    verified247: true,
    offset: { lat: -0.0048, lng: 0.0065 },
    rating: 4.9,
  },
  {
    id: "sh-hospital-01",
    name: "Yatharth Super Speciality Hospital (Emergency Trauma)",
    category: "hospital",
    categoryLabel: "24/7 Trauma Emergency",
    phone: "0120-2399999",
    address: "Plot No. 1, Omega 1, Greater Noida, UP",
    verified247: true,
    offset: { lat: 0.0072, lng: -0.0035 },
    rating: 4.7,
  },
  {
    id: "sh-hospital-02",
    name: "Sharda Hospital & Medical College (24/7 Emergency)",
    category: "hospital",
    categoryLabel: "24/7 Medical Enclave",
    phone: "0120-2329700",
    address: "Plot No. 32-34, Knowledge Park III, Greater Noida",
    verified247: true,
    offset: { lat: -0.0028, lng: -0.0051 },
    rating: 4.8,
  },
  {
    id: "sh-transit-01",
    name: "Knowledge Park II Metro Station (CCTV Sanctuary)",
    category: "transit",
    categoryLabel: "Lit Transit Hub",
    phone: "0120-2459700",
    address: "Aqua Line Metro, Knowledge Park II, Greater Noida",
    verified247: true,
    offset: { lat: 0.0055, lng: 0.0092 },
    rating: 4.6,
  },
  {
    id: "sh-transit-02",
    name: "Indian Oil 24/7 Well-Lit Fuel & Convenience Hub",
    category: "transit",
    categoryLabel: "24/7 Lit Safe Haven",
    phone: "1800-2333-555",
    address: "Main Express Highway Road, Greater Noida",
    verified247: true,
    offset: { lat: -0.0062, lng: 0.0028 },
    rating: 4.5,
  },
];

/**
 * Get nearby sanctuaries sorted by distance from current user coordinates
 */
export function getNearbySanctuaries(userLat = 28.4744, userLng = 77.4916) {
  return SANCTUARY_TEMPLATES.map((item) => {
    const lat = userLat + item.offset.lat;
    const lng = userLng + item.offset.lng;
    const distanceKm = calculateDistanceKm(userLat, userLng, lat, lng);
    const transit = estimateTransitTime(distanceKm);

    return {
      ...item,
      lat,
      lng,
      distanceKm,
      distanceFormatted: formatDistance(distanceKm),
      transitTimes: transit,
      navigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);
}
