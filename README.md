# @lp-labs/geohash-codec

Original geohash encoding, exact cell geometry, wrapped neighbors and bounded geographic box covers.

Original MIT TypeScript with **zero runtime or peer dependencies**. ESM/CommonJS with separate declarations. Node18+ and compatible ES2022 browsers with bigint. No network/filesystem/global services accessed on import. TypeScript/Prettier are development-only.

## Install

```sh
npm install @lp-labs/geohash-codec
```

## Working example

```js
import {
  encodeGeohash,
  decodeGeohash,
  geohashNeighbor,
  geohashContains,
  geohashChildren,
  coverGeohashBounds,
  GeohashError,
} from '@lp-labs/geohash-codec';
const point = { latitude: 42.6, longitude: -5.6 };
const hash = encodeGeohash(point, 5);
if (hash !== 'ezs42' || !geohashContains(hash, point)) throw new Error('Bad geohash');
const cell = decodeGeohash(hash);
if (coverGeohashBounds(cell.bounds, 5, 1)[0] !== hash) throw new Error('Bad cover');
if (geohashChildren(hash).length !== 32) throw new Error('Bad children');
const east = geohashNeighbor(hash, 'e');
if (!east || geohashNeighbor(east, 'w') !== hash) throw new Error('Bad neighbor');
if (!(new GeohashError('invalid', 'example') instanceof Error)) throw new Error('Error API');
```

CommonJS: `const api = require('@lp-labs/geohash-codec')`.

## Behavior, customization, errors and performance

Standard longitude-first interleaved geohash base32 alphabet0123456789bcdefghjkmnpqrstuvwxyz. encodeGeohash accepts finite latitude[-90,90]/longitude[-180,180] degrees and precision1..12 (default9). Values outside geographic bounds are rejected, not silently wrapped/clamped. Midpoint ties choose upper/east cell; north/east global endpoints90/180 map to the last row/column. -180 and+180 are distinct input boundary spellings, not canonicalized to one. decodeGeohash accepts upper/lowercase1..12 ASCII characters and returns canonical lowercase hash, bounds, center and half-height/width errors. Errors represent bounding-box coordinate extents, not a geodesic distance guarantee.

geohashContains uses EXACT encoding membership, so ordinary north/east cell edges belong to the neighboring cell, except world maxima; it is not inclusive point-in-box testing. geohashNeighbor supports n/ne/e/se/s/sw/w/nw, wraps across the dateline and returns undefined beyond either pole. At low precision directions can identify the same cell; no pretend unique8-neighbor set. geohashChildren returns32 canonical children; precision12 throws limit because higher precision is unsupported.

coverGeohashBounds returns fixed-precision cells with positive-area intersection with supplied box, ordered south-to-north rows then west-to-east. Bounds require finite coordinates, south<north, west<east, no antimeridian crossing; split crossing boxes explicitly. Edges are half-open in area calculations, so an exactly aligned box excludes merely touching neighboring cells. This is a covering set, not clipped polygons, polygon intersection, distance search or minimal mixed-precision prefix cover. maxCells default4096, allowed1..1000000; estimate full count BEFORE allocation and throw limit rather than truncate. Whole-world precision1 yields32 cells. Box size calculations use bounded30-bit per-axis indexes at precision12.

Output data is fresh/caller-owned. GeohashError.code invalid means bad type/coordinate/precision/hash/bounds/budget/direction; limit means cover budget or child precision exceeded. Encode/decode/neighbors O(precision) bounded60 bits, no signed32-bit interleave truncation; covers O(cells*precision) time/O(cells) memory. All computations synchronous binary floating-point coordinate arithmetic, not WGS84 geodesics, arbitrary geometric privacy guarantees or a spatial database. No network, map tiles, copied tables or runtime dependencies. Hostile proxies/getters are outside contract.

## Complete public API

Configure through these exported interfaces; no internal source edits are necessary.

```ts
export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}
export interface GeoBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}
export interface GeohashCell {
  hash: string;
  center: GeoCoordinate;
  bounds: GeoBounds;
  latitudeError: number;
  longitudeError: number;
}
export type GeoDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export declare class GeohashError extends Error {
  readonly code: 'invalid' | 'limit';
  constructor(code: 'invalid' | 'limit', message: string);
}
export declare function encodeGeohash(point: GeoCoordinate, length?: number): string;
export declare function decodeGeohash(hash: string): GeohashCell;
export declare function geohashNeighbor(hash: string, direction: GeoDirection): string | undefined;
export declare function geohashContains(hash: string, point: GeoCoordinate): boolean;
export declare function geohashChildren(hash: string): string[];
export declare function coverGeohashBounds(
  bounds: GeoBounds,
  length: number,
  maxCells?: number,
): string[];
```

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
