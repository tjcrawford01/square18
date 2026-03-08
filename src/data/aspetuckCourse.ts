/**
 * Hardcoded Aspetuck Valley CC for testing when golfapi.io is unavailable.
 * Source: square18-v4.jsx. Remove once API key is working.
 */
import type { Course, Hole, Tee } from '../types/course';

const HOLES: Hole[] = [
  { hole: 1, par: 4, si: 11, yards: 392 },
  { hole: 2, par: 4, si: 9, yards: 359 },
  { hole: 3, par: 4, si: 13, yards: 349 },
  { hole: 4, par: 5, si: 7, yards: 570 },
  { hole: 5, par: 3, si: 17, yards: 155 },
  { hole: 6, par: 5, si: 1, yards: 540 },
  { hole: 7, par: 4, si: 3, yards: 439 },
  { hole: 8, par: 3, si: 15, yards: 177 },
  { hole: 9, par: 4, si: 5, yards: 375 },
  { hole: 10, par: 4, si: 6, yards: 401 },
  { hole: 11, par: 5, si: 10, yards: 539 },
  { hole: 12, par: 3, si: 18, yards: 150 },
  { hole: 13, par: 4, si: 12, yards: 341 },
  { hole: 14, par: 4, si: 14, yards: 384 },
  { hole: 15, par: 4, si: 2, yards: 392 },
  { hole: 16, par: 4, si: 4, yards: 445 },
  { hole: 17, par: 3, si: 16, yards: 250 },
  { hole: 18, par: 4, si: 8, yards: 378 },
];

const TEES: Tee[] = [
  { name: 'Black', rating: 72.4, slope: 128, color: '#1a1a1a', holes: HOLES },
  { name: 'Blue', rating: 70.5, slope: 126, color: '#1a4a8a', holes: HOLES },
  { name: 'White', rating: 68.8, slope: 125, color: '#e8e8e8', holes: HOLES },
  { name: 'Green', rating: 67.5, slope: 122, color: '#2d6a4f', holes: HOLES },
];

export const ASPETUCK_COURSE: Course = {
  id: 'aspetuck',
  name: 'Aspetuck Valley CC',
  location: 'Weston, CT',
  tees: TEES,
  holes: HOLES,
};
