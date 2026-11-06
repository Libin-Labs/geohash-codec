const alphabet = '0123456789bcdefghjkmnpqrstuvwxyz';
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
export class GeohashError extends Error {
  constructor(
    readonly code: 'invalid' | 'limit',
    message: string,
  ) {
    super(message);
    this.name = 'GeohashError';
  }
}
function invalid(message: string): never {
  throw new GeohashError('invalid', message);
}
function precision(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 12)
    invalid('Precision must be an integer in 1..12.');
}
function coordinate(value: GeoCoordinate): void {
  if (
    !value ||
    typeof value !== 'object' ||
    !Number.isFinite(value.latitude) ||
    value.latitude < -90 ||
    value.latitude > 90 ||
    !Number.isFinite(value.longitude) ||
    value.longitude < -180 ||
    value.longitude > 180
  )
    invalid('Latitude/longitude must be finite degrees in [-90,90]/[-180,180].');
}
function bitsFor(length: number): { longitude: number; latitude: number } {
  return { longitude: Math.ceil((length * 5) / 2), latitude: Math.floor((length * 5) / 2) };
}
function axisIndex(value: number, lower: number, upper: number, bits: number): number {
  let index = 0;
  for (let bit = 0; bit < bits; bit++) {
    const midpoint = (lower + upper) / 2;
    index *= 2;
    if (value >= midpoint) {
      index++;
      lower = midpoint;
    } else upper = midpoint;
  }
  return index;
}
function fromIndices(x: number, y: number, length: number): string {
  const bits = bitsFor(length);
  let value = 0,
    count = 0,
    hash = '';
  for (let bit = 0; bit < length * 5; bit++) {
    const longitude = bit % 2 === 0;
    const offset = (longitude ? bits.longitude : bits.latitude) - 1 - Math.floor(bit / 2);
    const digit = Math.floor((longitude ? x : y) / 2 ** offset) % 2;
    value = value * 2 + digit;
    count++;
    if (count === 5) {
      hash += alphabet[value]!;
      value = 0;
      count = 0;
    }
  }
  return hash;
}
export function encodeGeohash(point: GeoCoordinate, length = 9): string {
  coordinate(point);
  precision(length);
  const bits = bitsFor(length);
  const x = axisIndex(point.longitude, -180, 180, bits.longitude);
  const y = axisIndex(point.latitude, -90, 90, bits.latitude);
  return fromIndices(x, y, length);
}
export function decodeGeohash(hash: string): GeohashCell {
  if (
    typeof hash !== 'string' ||
    hash.length < 1 ||
    hash.length > 12 ||
    /[^0123456789bcdefghjkmnpqrstuvwxyz]/i.test(hash)
  )
    invalid('Geohash needs 1..12 base32 characters, no whitespace.');
  const canonical = hash.toLowerCase(),
    bits = bitsFor(hash.length);
  let x = 0,
    y = 0,
    position = 0;
  for (const char of canonical) {
    const value = alphabet.indexOf(char);
    for (let shift = 4; shift >= 0; shift--) {
      const digit = (value >> shift) & 1;
      if (position++ % 2 === 0) x = x * 2 + digit;
      else y = y * 2 + digit;
    }
  }
  const width = 360 / 2 ** bits.longitude,
    height = 180 / 2 ** bits.latitude;
  const west = -180 + x * width,
    south = -90 + y * height;
  return {
    hash: canonical,
    center: { latitude: south + height / 2, longitude: west + width / 2 },
    bounds: { south, west, north: south + height, east: west + width },
    latitudeError: height / 2,
    longitudeError: width / 2,
  };
}
export function geohashNeighbor(hash: string, direction: GeoDirection): string | undefined {
  const cell = decodeGeohash(hash),
    bits = bitsFor(hash.length);
  const columns = 2 ** bits.longitude,
    rows = 2 ** bits.latitude;
  const directions: Record<GeoDirection, readonly [number, number]> = {
    n: [0, 1],
    ne: [1, 1],
    e: [1, 0],
    se: [1, -1],
    s: [0, -1],
    sw: [-1, -1],
    w: [-1, 0],
    nw: [-1, 1],
  };
  if (!Object.hasOwn(directions, direction)) invalid('Unknown neighboring direction.');
  const [dx, dy] = directions[direction];
  const x = Math.round(((cell.bounds.west + 180) / 360) * columns);
  const y = Math.round(((cell.bounds.south + 90) / 180) * rows) + dy;
  if (y < 0 || y >= rows) return undefined;
  return fromIndices((x + dx + columns) % columns, y, hash.length);
}
export function geohashContains(hash: string, point: GeoCoordinate): boolean {
  coordinate(point);
  const cell = decodeGeohash(hash);
  return encodeGeohash(point, hash.length) === cell.hash;
}
export function geohashChildren(hash: string): string[] {
  const cell = decodeGeohash(hash);
  if (hash.length === 12) throw new GeohashError('limit', 'Precision12 has no supported children.');
  return [...alphabet].map((char) => cell.hash + char);
}
export function coverGeohashBounds(bounds: GeoBounds, length: number, maxCells = 4096): string[] {
  precision(length);
  if (!bounds || typeof bounds !== 'object') invalid('Expected geographic bounds.');
  coordinate({ latitude: bounds.south, longitude: bounds.west });
  coordinate({ latitude: bounds.north, longitude: bounds.east });
  if (bounds.south >= bounds.north || bounds.west >= bounds.east)
    invalid('Bounds must have positive area and cannot cross the antimeridian; split explicitly.');
  if (!Number.isSafeInteger(maxCells) || maxCells < 1 || maxCells > 1000000)
    invalid('maxCells must be in 1..1000000.');
  const bits = bitsFor(length),
    columns = 2 ** bits.longitude,
    rows = 2 ** bits.latitude;
  const west = axisIndex(bounds.west, -180, 180, bits.longitude);
  let east = axisIndex(bounds.east, -180, 180, bits.longitude);
  const south = axisIndex(bounds.south, -90, 90, bits.latitude);
  let north = axisIndex(bounds.north, -90, 90, bits.latitude);
  if (-180 + east * (360 / columns) === bounds.east) east--;
  if (-90 + north * (180 / rows) === bounds.north) north--;
  const count = (east - west + 1) * (north - south + 1);
  if (!Number.isSafeInteger(count) || count > maxCells)
    throw new GeohashError('limit', 'Bounding cover exceeds cell budget.');
  const result: string[] = [];
  for (let y = south; y <= north; y++)
    for (let x = west; x <= east; x++) result.push(fromIndices(x, y, length));
  return result;
}
