/** Standard FIVB net heights, in meters. Configurable per RuleSet in Phase 2. */
export const MENS_NET_HEIGHT_M = 2.43;
export const WOMENS_NET_HEIGHT_M = 2.24;

export interface CourtSpec {
  lengthM: number; // 18 — full court, both halves
  widthM: number; // 9
  halfLengthM: number; // 9 — one team's half
  attackLineM: number; // 3, measured from the center line
  netHeightM: number;
  netTopBandM: number; // height of the net's top tape band
  netDepthM: number; // visual mesh panel height below the top band
  antennaSpanM: number; // 9 — antennas sit on the sideline planes
  antennaAboveNetM: number; // 0.8
  freeZoneM: number; // 3 default, 5 under FIVB
  serviceZoneDepthM: number; // depth behind the endline reserved for serving
}

export const DEFAULT_COURT_SPEC: CourtSpec = {
  lengthM: 18,
  widthM: 9,
  halfLengthM: 9,
  attackLineM: 3,
  netHeightM: MENS_NET_HEIGHT_M,
  netTopBandM: 0.07,
  netDepthM: 1.0,
  antennaSpanM: 9,
  antennaAboveNetM: 0.8,
  freeZoneM: 3,
  serviceZoneDepthM: 3,
};
