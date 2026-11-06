import {
  encodeGeohash,
  decodeGeohash,
  geohashNeighbor,
  geohashContains,
  geohashChildren,
  coverGeohashBounds,
  GeohashError,
  type GeoCoordinate,
  type GeoBounds,
} from '@lp-labs/geohash-codec';
const point: GeoCoordinate = { latitude: 0, longitude: 0 };
const hash: string = encodeGeohash(point, 5);
const bounds: GeoBounds = decodeGeohash(hash).bounds;
const neighbor: string | undefined = geohashNeighbor(hash, 'n');
const included: boolean = geohashContains(hash, point);
const children: string[] = geohashChildren(hash);
const cover: string[] = coverGeohashBounds(bounds, 5);
const code: 'invalid' | 'limit' = new GeohashError('invalid', 'x').code;
void neighbor;
void included;
void children;
void cover;
void code;
// @ts-expect-error Explicit latitude/longitude coordinates required
encodeGeohash([0, 0]);
