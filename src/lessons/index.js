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
import { tables } from './tables.js';
import { filtering } from './filtering.js';
import { selecting } from './selecting.js';
import { mutating } from './mutating.js';
import { arranging } from './arranging.js';
import { grouping } from './grouping.js';
import { counting } from './counting.js';

export const LESSONS = [
  vectors,
  types,
  vectorised,
  missing,
  subsetting,
  factors,
  tables,
  filtering,
  selecting,
  mutating,
  arranging,
  grouping,
  counting,
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
