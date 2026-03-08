/**
 * Course data model — maps from golfapi.io (or any provider).
 * Hole.par, Hole.si, Hole.yards are per-tee where the API provides them.
 */

export interface Hole {
  hole: number;
  par: number;
  si: number; // stroke index 1–18; 0 or null means use fallback
  yards: number;
}

/** Alias for engine/screen code that used HoleInfo from aspetuck. */
export type HoleInfo = Hole;

export interface Tee {
  name: string;
  rating: number;
  slope: number;
  color: string;
  holes: Hole[];
}

export interface Course {
  id: string;
  name: string;
  location: string; // "City, State"
  tees: Tee[];
  holes: Hole[]; // 18 holes (default/primary); tees may override yards per tee
}

/** Infer tee color from name when API doesn't provide it. */
export function teeColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('black')) return '#1a1a1a';
  if (n.includes('blue')) return '#1a4a8a';
  if (n.includes('white')) return '#e8e8e8';
  if (n.includes('gold') || n.includes('yellow')) return '#b8953a';
  if (n.includes('red')) return '#8b2020';
  if (n.includes('green')) return '#2d6a4f';
  if (n.includes('silver')) return '#888888';
  return '#8a9e90';
}

export function getTee(course: Course | null, teeName: string): Tee | undefined {
  return course?.tees?.find((t) => t.name === teeName);
}

export function getTeeOrDefault(course: Course | null, teeName: string): Tee | null {
  const tee = getTee(course, teeName);
  if (tee) return tee;
  return course?.tees?.[0] ?? null;
}

/** Holes for a given tee (or course default). */
export function getHolesForTee(course: Course | null, teeName: string): Hole[] {
  const tee = getTeeOrDefault(course, teeName);
  return tee?.holes ?? course?.holes ?? [];
}

/** True if any hole has missing/invalid stroke index. */
export function hasMissingStrokeIndex(course: Course | null): boolean {
  const holes = course?.holes ?? course?.tees?.[0]?.holes ?? [];
  return holes.some((h) => !h.si || h.si < 1 || h.si > 18);
}

/** Apply fallback SI: hole 1 = 1, hole 2 = 2, ... */
export function applyStrokeIndexFallback(course: Course): Course {
  const holes = course.holes?.length === 18 ? [...course.holes] : course.tees?.[0]?.holes ?? [];
  const fixed = holes.map((h, i) => ({ ...h, si: h.si >= 1 && h.si <= 18 ? h.si : i + 1 }));
  const updateTee = (t: Tee): Tee => ({ ...t, holes: t.holes.map((h, i) => ({ ...h, si: fixed[i]?.si ?? i + 1 })) });
  return {
    ...course,
    holes: fixed,
    tees: course.tees.map(updateTee),
  };
}
