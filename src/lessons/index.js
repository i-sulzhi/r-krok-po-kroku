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
import { crosstab } from './crosstab.js';
import { battery } from './battery.js';
import { joining } from './joining.js';
import { reporting } from './reporting.js';
import { plotFirst } from './plot-first.js';
import { plotCount } from './plot-count.js';
import { plotFill } from './plot-fill.js';
import { plotOrder } from './plot-order.js';
import { plotTypes } from './plot-types.js';
import { plotFacets } from './plot-facets.js';
import { plotReport } from './plot-report.js';
import { plotBuild } from './plot-build.js';
import { missingData } from './missing-data.js';

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
  crosstab,
  battery,
  joining,
  missingData,
  reporting,
  plotFirst,
  plotCount,
  plotFill,
  plotOrder,
  plotTypes,
  plotFacets,
  plotReport,
  plotBuild,
];

/**
 * References to other exercises are written `{ćw:id}` and become numbers here (D65).
 * Numbering is continuous, so a new exercise moves every number after it; a
 * hard-written "ćwiczenie 23" would silently point at the wrong one.
 */
function resolveRefs(value) {
  if (typeof value === 'string') {
    return value.replace(/\{ćw:([\w-]+)\}/g, (_, id) => {
      const at = LESSONS.findIndex((l) => l.id === id);
      if (at < 0) throw new Error(`unknown exercise in a reference: ${id}`);
      return String(at + 1);
    });
  }
  if (Array.isArray(value)) return value.map(resolveRefs);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const k of Object.keys(value)) value[k] = resolveRefs(value[k]);
  }
  return value;
}
LESSONS.forEach(resolveRefs);

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
