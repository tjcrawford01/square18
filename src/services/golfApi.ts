/**
 * Golf API client (golfapi.io).
 * Field mapping per square18-golfapi-mapping.md.
 * API key from .env GOLFAPI_KEY, passed via app.config.js extra.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import type { Course, Hole, Tee } from '../types/course';

const CACHE_PREFIX = 'course:';
const LAST_COURSE_KEY = 'lastCourseId';
const BASE = 'https://www.golfapi.io/api/v2.3';
export const ASPETUCK_API_ID = '012141520679645759931';

function getApiKey(): string {
  const key = (Constants.expoConfig?.extra as { GOLFAPI_KEY?: string } | undefined)?.GOLFAPI_KEY ?? '';
  return typeof key === 'string' ? key.trim() : '';
}

function getHeaders(): HeadersInit {
  const key = getApiKey();
  return {
    'Content-Type': 'application/json',
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  };
}

/** Course list item from search / geo (map from API response). */
export interface CourseListItem {
  id: string;
  name: string;
  location: string;
  distanceMiles?: number;
}

/** API club shape (search response). */
interface ApiClub {
  clubID?: string;
  clubName?: string;
  city?: string;
  state?: string;
  country?: string;
  distance?: string | number;
  courses?: { courseID?: string; courseName?: string; numHoles?: number }[];
}

/** Geo search: same /clubs endpoint with lat & lng. */
export async function searchByLocation(lat: number, lng: number): Promise<CourseListItem[]> {
  const key = getApiKey();
  if (!key) return [];
  try {
    const url = `${BASE}/clubs?lat=${lat}&lng=${lng}&limit=5`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return mapClubsToList(data);
  } catch {
    return [];
  }
}

/** Search by name. */
export async function searchByName(query: string): Promise<CourseListItem[]> {
  const key = getApiKey();
  if (!key || query.length < 3) return [];
  try {
    const url = `${BASE}/clubs?name=${encodeURIComponent(query)}&limit=8`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return mapClubsToList(data);
  } catch {
    return [];
  }
}

function mapClubsToList(data: { clubs?: ApiClub[] }): CourseListItem[] {
  const arr = data?.clubs ?? [];
  const list: CourseListItem[] = [];
  for (const item of arr) {
    const courses = item.courses ?? [];
    const first = courses[0];
    const courseId = first?.courseID ?? '';
    const name = String(item.clubName ?? '');
    const city = String(item.city ?? '');
    const state = String(item.state ?? '');
    const location = [city, state].filter(Boolean).join(', ') || '—';
    let distanceMiles: number | undefined;
    if (typeof item.distance === 'number') distanceMiles = item.distance;
    else if (typeof item.distance === 'string' && item.distance !== '') distanceMiles = parseFloat(item.distance);
    if (courseId && name) list.push({ id: courseId, name, location, distanceMiles });
  }
  return list.slice(0, 8);
}

/**
 * Get full course detail. Uses cache: returns cached if present.
 * Pass forceRefresh: true to bypass cache (e.g. for Aspetuck to get updated ratings).
 */
export async function getCourseDetail(courseId: string, forceRefresh = false): Promise<Course | null> {
  const effectiveId = courseId === 'aspetuck' ? ASPETUCK_API_ID : courseId;
  const cacheKey = CACHE_PREFIX + effectiveId;

  if (!forceRefresh) {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as Course;
      } catch {
        // fall through to fetch
      }
    }
  }

  const key = getApiKey();
  if (!key) return null;
  try {
    const url = `${BASE}/courses/${effectiveId}`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    const course = mapApiCourseToCourse(data);
    if (course) await AsyncStorage.setItem(cacheKey, JSON.stringify(course));
    return course;
  } catch {
    return null;
  }
}

/** API tee shape. */
interface ApiTee {
  teeID?: string;
  teeName?: string;
  teeColor?: string;
  courseRatingMen?: string | number;
  slopeMen?: string | number;
  [key: string]: unknown;
}

/**
 * Map API course response to our Course model.
 * parsMen, indexesMen are 18-element arrays; yardages are length1..length18 per tee.
 */
function mapApiCourseToCourse(d: Record<string, unknown>): Course | null {
  const name = String(d.clubName ?? d.courseName ?? '');
  const city = String(d.city ?? '');
  const state = String(d.state ?? '');
  const location = [city, state].filter(Boolean).join(', ') || '—';
  const courseId = String(d.courseID ?? '');

  const parsMen = (d.parsMen as number[] | undefined) ?? [];
  const indexesMen = (d.indexesMen as number[] | undefined) ?? [];

  const teesRaw = (d.tees as ApiTee[] | undefined) ?? [];
  const tees: Tee[] = [];

  for (const t of teesRaw) {
    const ratingVal = t.courseRatingMen;
    if (ratingVal === '' || ratingVal === undefined || ratingVal === null) continue;
    const rating = Number(ratingVal);
    const slope = Number(t.slopeMen ?? 113);
    const teeName = String(t.teeName ?? '');
    const color = String(t.teeColor ?? '#8a9e90');

    const holes: Hole[] = [];
    for (let i = 0; i < 18; i++) {
      const par = parsMen[i] ?? 4;
      const si = indexesMen[i] ?? i + 1;
      const lengthKey = `length${i + 1}` as keyof ApiTee;
      const yards = Number(t[lengthKey] ?? 0);
      holes.push({
        hole: i + 1,
        par: par >= 3 && par <= 5 ? par : 4,
        si: si >= 1 && si <= 18 ? si : i + 1,
        yards: yards || 0,
      });
    }
    if (holes.length === 18) {
      tees.push({ name: teeName, rating, slope, color, holes });
    }
  }

  const defaultHoles: Hole[] = parsMen.length >= 18
    ? parsMen.slice(0, 18).map((par, i) => ({
        hole: i + 1,
        par: par >= 3 && par <= 5 ? par : 4,
        si: (indexesMen[i] >= 1 && indexesMen[i] <= 18 ? indexesMen[i] : i + 1) as number,
        yards: 0,
      }))
    : [];

  if (!name) return null;

  return {
    id: courseId,
    name,
    location,
    tees,
    holes: tees[0]?.holes ?? (defaultHoles.length === 18 ? defaultHoles : []),
  };
}

export async function getLastCourseId(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_COURSE_KEY);
}

export async function setLastCourseId(courseId: string): Promise<void> {
  await AsyncStorage.setItem(LAST_COURSE_KEY, courseId);
}
