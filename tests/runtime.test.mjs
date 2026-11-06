import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeGeohash,
  decodeGeohash,
  geohashNeighbor,
  geohashContains,
  geohashChildren,
  coverGeohashBounds,
  GeohashError,
} from '../dist/esm/index.js';
test('known geohash examples and exact bounding geometry', () => {
  assert.equal(encodeGeohash({ latitude: 42.6, longitude: -5.6 }, 5), 'ezs42');
  assert.equal(encodeGeohash({ latitude: 57.64911, longitude: 10.40744 }, 11), 'u4pruydqqvj');
  const cell = decodeGeohash('ezs42');
  assert.deepEqual(cell.bounds, {
    south: 42.5830078125,
    west: -5.625,
    north: 42.626953125,
    east: -5.5810546875,
  });
  assert.equal(cell.center.latitude, (cell.bounds.south + cell.bounds.north) / 2);
  assert.equal(cell.latitudeError, (cell.bounds.north - cell.bounds.south) / 2);
});
test('case normalization and cell center encode reproduce each precision', () => {
  for (let precision = 1; precision <= 12; precision++) {
    const hash = encodeGeohash({ latitude: 12.345678, longitude: -98.765432 }, precision);
    const cell = decodeGeohash(hash.toUpperCase());
    assert.equal(cell.hash, hash);
    assert.equal(encodeGeohash(cell.center, precision), hash);
    assert.ok(geohashContains(hash, cell.center));
  }
});
test('dateline wraps east west and pole neighbors are explicitly absent', () => {
  const right = encodeGeohash({ latitude: 0, longitude: 180 }, 5);
  const left = geohashNeighbor(right, 'e');
  assert.equal(decodeGeohash(left).bounds.west, -180);
  assert.equal(geohashNeighbor(left, 'w'), right);
  const north = encodeGeohash({ latitude: 90, longitude: 0 }, 5);
  assert.equal(geohashNeighbor(north, 'n'), undefined);
  assert.equal(geohashNeighbor(north, 'ne'), undefined);
  assert.equal(geohashNeighbor(encodeGeohash({ latitude: -90, longitude: 0 }, 5), 's'), undefined);
});
test('neighbor directions have correct cell-size displacements', () => {
  const hash = 'u4pru',
    original = decodeGeohash(hash);
  for (const [direction, dx, dy] of [
    ['n', 0, 1],
    ['ne', 1, 1],
    ['e', 1, 0],
    ['se', 1, -1],
    ['s', 0, -1],
    ['sw', -1, -1],
    ['w', -1, 0],
    ['nw', -1, 1],
  ]) {
    const other = decodeGeohash(geohashNeighbor(hash, direction));
    assert.equal(
      other.center.longitude - original.center.longitude,
      dx * 2 * original.longitudeError,
    );
    assert.equal(other.center.latitude - original.center.latitude, dy * 2 * original.latitudeError);
  }
});
test('children exactly partition parent area and budget maximum precision', () => {
  const children = geohashChildren('ezs4');
  assert.equal(children.length, 32);
  assert.equal(new Set(children).size, 32);
  for (const child of children) assert.equal(encodeGeohash(decodeGeohash(child).center, 4), 'ezs4');
  assert.throws(() => geohashChildren('u4pruydqqvj8'), { code: 'limit' });
});
test('cover exact cell returns only that cell with half-open area edges', () => {
  const cell = decodeGeohash('ezs42');
  assert.deepEqual(coverGeohashBounds(cell.bounds, 5, 1), ['ezs42']);
  const expanded = { ...cell.bounds, east: cell.bounds.east + cell.longitudeError };
  assert.equal(coverGeohashBounds(expanded, 5, 2).length, 2);
  assert.throws(() => coverGeohashBounds(expanded, 5, 1), { code: 'limit' });
});
test('whole world at precision1 consists of32 unique cells', () => {
  const hashes = coverGeohashBounds({ south: -90, west: -180, north: 90, east: 180 }, 1, 32);
  assert.equal(hashes.length, 32);
  assert.equal(new Set(hashes).size, 32);
  assert.throws(() => coverGeohashBounds({ south: -90, west: -180, north: 90, east: 180 }, 12), {
    code: 'limit',
  });
});
test('strict types malformed alphabets final newlines and invalid bounds rejected', () => {
  for (const hash of ['', 'a', 'ezs42\n', 'EZ S42', 'z'.repeat(13), 'é'])
    assert.throws(() => decodeGeohash(hash), GeohashError);
  for (const point of [
    { latitude: NaN, longitude: 0 },
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: 181 },
  ])
    assert.throws(() => encodeGeohash(point), { code: 'invalid' });
  for (const precision of [0, 13, 1.5, NaN])
    assert.throws(() => encodeGeohash({ latitude: 0, longitude: 0 }, precision), GeohashError);
  assert.throws(() => geohashNeighbor('ezs42', 'bad'), GeohashError);
  for (const bounds of [
    { south: 0, west: 170, north: 10, east: -170 },
    { south: 0, west: 0, north: 0, east: 1 },
  ])
    assert.throws(() => coverGeohashBounds(bounds, 5), GeohashError);
});
test('seeded known-coordinate encoding agrees with independent bisection oracle', () => {
  let state = 17;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const alphabet = '0123456789bcdefghjkmnpqrstuvwxyz';
  for (let sample = 0; sample < 500; sample++) {
    const point = { latitude: random() * 180 - 90, longitude: random() * 360 - 180 },
      precision = 1 + Math.floor(random() * 12);
    const low = [-180, -90],
      high = [180, 90],
      positions = [point.longitude, point.latitude];
    let bits = '',
      expected = '';
    for (let index = 0; index < precision * 5; index++) {
      const axis = index % 2,
        mid = (low[axis] + high[axis]) / 2,
        digit = positions[axis] >= mid;
      bits += digit ? '1' : '0';
      if (digit) low[axis] = mid;
      else high[axis] = mid;
    }
    for (let index = 0; index < bits.length; index += 5)
      expected += alphabet[parseInt(bits.slice(index, index + 5), 2)];
    assert.equal(encodeGeohash(point, precision), expected);
    assert.ok(geohashContains(expected, point));
  }
});
test('outputs detached and invalid cover budgets rejected', () => {
  const cell = decodeGeohash('ezs42');
  cell.bounds.west = 0;
  assert.equal(decodeGeohash('ezs42').bounds.west, -5.625);
  for (const budget of [0, 1.2, NaN, 1000001])
    assert.throws(() => coverGeohashBounds({ south: 0, west: 0, north: 1, east: 1 }, 1, budget), {
      code: 'invalid',
    });
  test('sub-epsilon coordinates near zero retain the correct half-plane and positive cover', () => {
    const west = encodeGeohash({ latitude: -1e-16, longitude: -1e-16 }, 12);
    const east = encodeGeohash({ latitude: 1e-16, longitude: 1e-16 }, 12);
    assert.notEqual(west, east);
    assert.equal(decodeGeohash(west).bounds.east, 0);
    assert.equal(decodeGeohash(east).bounds.west, 0);
    assert.equal(
      coverGeohashBounds({ south: -1e-16, west: -1e-16, north: 1e-16, east: 1e-16 }, 12, 4).length,
      4,
    );
  });
});
