import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS, initialSides, rotate, solutionSides, trace, validateLevel } from '../dist/core.mjs';

test('all authored gardens have valid layouts and working solutions', () => {
  assert.equal(LEVELS.length, 10);
  for (const garden of LEVELS) {
    assert.equal(validateLevel(garden), true, garden.name);
    assert.equal(trace(garden, solutionSides(garden)).reached.size, garden.flowers.length, garden.name);
    assert.equal(trace(garden, initialSides(garden)).won, false, `${garden.name} starts solved`);
  }
});

test('turning a mirror twice restores the board', () => {
  for (const garden of LEVELS) {
    const sides = initialSides(garden);
    assert.deepEqual(rotate(rotate(sides, 0), 0), sides, garden.name);
  }
});

test('beams stay bounded, including branch layouts', () => {
  for (const garden of LEVELS) {
    const { segments } = trace(garden, initialSides(garden));
    assert.ok(segments.length < garden.size * garden.size * 8, garden.name);
  }
});
