/**
 * The lesson registry.
 *
 * Order here is the order a student walks through. Lessons are plain data, so adding
 * one means writing content, not code -- and test/lessons.mjs validates every entry
 * against the schema and actually solves each task.
 */

import { vectors } from './vectors.js';
import { types } from './types.js';
import { vectorised } from './vectorised.js';
import { missing } from './missing.js';
import { subsetting } from './subsetting.js';
import { factors } from './factors.js';
import { levels } from './levels.js';
import { factorNumbers } from './factor-numbers.js';
import { tables } from './tables.js';
import { factorTable } from './factor-table.js';
import { filtering } from './filtering.js';
import { selecting } from './selecting.js';
import { mutating } from './mutating.js';
import { arranging } from './arranging.js';
import { grouping } from './grouping.js';
import { counting } from './counting.js';
import { pipeline } from './pipeline.js';
import { recoding } from './recoding.js';
import { percentages } from './percentages.js';

export const LESSONS = [
  vectors,
  types,
  vectorised,
  missing,
  subsetting,
  factors,
  levels,
  factorNumbers,
  tables,
  factorTable,
  filtering,
  selecting,
  mutating,
  arranging,
  grouping,
  counting,
  pipeline,
  recoding,
  percentages,
];

export const lessonById = (id) => LESSONS.find((l) => l.id === id) || null;

/** Lessons grouped by curriculum module, for the contents list. */
export function lessonsByModule() {
  const modules = new Map();
  for (const lesson of LESSONS) {
    if (!modules.has(lesson.module)) modules.set(lesson.module, []);
    modules.get(lesson.module).push(lesson);
  }
  return [...modules.entries()].sort((a, b) => a[0] - b[0]);
}

/**
 * The contents list (D33): lectures in order, each holding its modules.
 * @returns {Array<[number, Array<[number, Lesson[]]>]>}
 */
export function lessonsByLecture() {
  const lectures = new Map();
  for (const [module, lessons] of lessonsByModule()) {
    for (const lesson of lessons) {
      if (!lectures.has(lesson.lecture)) lectures.set(lesson.lecture, new Map());
      const modules = lectures.get(lesson.lecture);
      if (!modules.has(module)) modules.set(module, []);
      modules.get(module).push(lesson);
    }
  }
  return [...lectures.entries()].sort((a, b) => a[0] - b[0]).map(([n, modules]) => [n, [...modules.entries()]]);
}
