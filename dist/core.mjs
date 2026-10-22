export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

const level = (name, line, source, flowers, mirrors, prisms = [], rocks = []) => ({
  name, line, size: 7, source, flowers, mirrors, prisms, rocks,
});

// Mirror entries are [x, y, solution, starting side]. 0 is / and 1 is \\.
// Levels are deliberately authored rather than random: every garden has a
// small, learnable route and all solution states are checked by the test suite.
export const LEVELS = [
  level('First spark', 'Every light starts somewhere.', [0, 3, 0], [[2, 0]], [[2, 3, 0, 1]], [], [[5, 5]]),
  level('The bend', 'A little turn changes everything.', [0, 5, 0], [[6, 2]], [[2, 5, 0, 1], [2, 2, 0, 1]], [], [[4, 4]]),
  level('Warm current', 'Follow the ray around the ridge.', [0, 4, 0], [[5, 5]], [[2, 4, 0, 1], [2, 1, 0, 1], [5, 1, 1, 0]], [], [[4, 3], [6, 6]]),
  level('Far bank', 'The way home may begin to the left.', [6, 5, 2], [[1, 2]], [[4, 5, 1, 0], [4, 2, 1, 0]], [], [[2, 5], [5, 3]]),
  level('Golden hour', 'Carry a spark across the whole sky.', [0, 6, 0], [[6, 4]], [[2, 6, 0, 1], [2, 1, 0, 1], [5, 1, 1, 0], [5, 4, 1, 0]], [], [[0, 0], [6, 6]]),
  level('Split the sun', 'Prisms send light in two directions.', [0, 3, 0], [[4, 0], [6, 5]], [[4, 3, 0, 1], [2, 5, 1, 0]], [[2, 3]], [[0, 6]]),
  level('Twin groves', 'One beam, two waking places.', [3, 0, 1], [[1, 0], [0, 5]], [[1, 2, 1, 0], [3, 5, 0, 1]], [[3, 2]], [[6, 6], [5, 4]]),
  level('Sunset loop', 'A long route can be a lovely one.', [6, 6, 2], [[5, 1]], [[4, 6, 1, 0], [4, 4, 1, 0], [1, 4, 0, 1], [1, 5, 1, 0], [5, 5, 0, 1]], [], [[2, 6], [6, 0]]),
  level('Amber branches', 'Let both paths find their own way.', [0, 1, 0], [[6, 4], [0, 4]], [[5, 1, 1, 0], [5, 4, 1, 0], [2, 4, 0, 1]], [[2, 1]], [[6, 6]]),
  level('Home again', 'A little light can wake a whole world.', [0, 1, 0], [[5, 4], [6, 5], [0, 6]], [[5, 1, 1, 0], [2, 5, 1, 0], [0, 3, 0, 1]], [[2, 1], [2, 3]], [[4, 6]]),
  level('One more morning', 'Even home has a new sunrise.', [0, 3, 0], [[2, 0], [4, 5]], [[2, 3, 0, 1], [4, 1, 1, 0]], [[2, 1]], [[6, 6], [0, 6]]),
];

export function initialSides(levelData) {
  return levelData.mirrors.map((mirror) => mirror[3]);
}

export function unlockedFromProgress(completed, storedUnlocked, levelCount = LEVELS.length) {
  let unlocked = Math.min(Math.max(Number(storedUnlocked) || 0, 0), levelCount - 1);
  completed.forEach((done, index) => {
    if (done && index < levelCount - 1) unlocked = Math.max(unlocked, index + 1);
  });
  return unlocked;
}

export function solutionSides(levelData) {
  return levelData.mirrors.map((mirror) => mirror[2]);
}

export function rotate(sides, index) {
  return sides.map((side, i) => i === index ? 1 - side : side);
}

export function trace(levelData, sides) {
  const { size, source, mirrors, prisms, flowers, rocks } = levelData;
  const mirrorAt = new Map(mirrors.map((m, i) => [`${m[0]},${m[1]}`, i]));
  const prismAt = new Set(prisms.map(([x, y]) => `${x},${y}`));
  const rockAt = new Set(rocks.map(([x, y]) => `${x},${y}`));
  const flowerAt = new Set(flowers.map(([x, y]) => `${x},${y}`));
  const reached = new Set();
  const segments = [];
  const visited = new Set();
  const queue = [{ x: source[0], y: source[1], dir: source[2], depth: 0 }];
  const limit = size * size * 8;
  let steps = 0;

  while (queue.length && steps < limit) {
    const ray = queue.shift();
    let { x, y, dir } = ray;
    while (++steps < limit) {
      const key = `${x},${y},${dir}`;
      if (visited.has(key)) break;
      visited.add(key);
      const [dx, dy] = DIRS[dir];
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) {
        segments.push({ x1: x, y1: y, x2: x + dx * .48, y2: y + dy * .48, depth: ray.depth, fade: true });
        break;
      }
      const nextKey = `${nx},${ny}`;
      segments.push({ x1: x, y1: y, x2: nx, y2: ny, depth: ray.depth });
      if (rockAt.has(nextKey)) break;
      if (flowerAt.has(nextKey)) { reached.add(nextKey); break; }
      x = nx; y = ny;
      const mirrorIndex = mirrorAt.get(nextKey);
      if (mirrorIndex !== undefined) {
        // / : E->N, S->W, W->S, N->E
        // \\ : E->S, S->E, W->N, N->W
        dir = sides[mirrorIndex] === 0 ? [3, 2, 1, 0][dir] : [1, 0, 3, 2][dir];
      } else if (prismAt.has(nextKey)) {
        queue.push({ x, y, dir: (dir + 1) % 4, depth: ray.depth + 1 });
      }
    }
  }

  return { segments, reached, won: flowers.every(([x, y]) => reached.has(`${x},${y}`)) };
}

export function validateLevel(levelData) {
  const occupied = new Set();
  const cells = [levelData.source.slice(0, 2), ...levelData.flowers, ...levelData.mirrors.map(m => m.slice(0, 2)), ...levelData.prisms, ...levelData.rocks];
  for (const [x, y] of cells) {
    if (x < 0 || y < 0 || x >= levelData.size || y >= levelData.size) return false;
    const key = `${x},${y}`;
    if (occupied.has(key)) return false;
    occupied.add(key);
  }
  return trace(levelData, solutionSides(levelData)).won;
}
