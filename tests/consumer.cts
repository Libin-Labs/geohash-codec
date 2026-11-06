import { geohashNeighbor, type GeoDirection } from '@lp-labs/geohash-codec';
const direction: GeoDirection = 'nw';
const hash: string | undefined = geohashNeighbor('ezs42', direction);
void hash;
// @ts-expect-error Unknown direction
geohashNeighbor('ezs42', 'up');
