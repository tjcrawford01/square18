/**
 * Hardcoded Aspetuck Valley CC for testing when golfapi.io is unavailable.
 * Source: square18-v4.jsx. Remove once API key is working.
 */
import type { Course, Hole, Tee } from '../types/course';

// Pars (men): 4,4,4,5,3,5,4,3,4,4,5,3,4,4,4,4,3,4 (par 71, front 36, back 35)
// Stroke indexes (men): 11,9,13,7,17,1,3,15,5,6,10,18,12,14,4,2,16,8
const MENS_PAR = [4, 4, 4, 5, 3, 5, 4, 3, 4, 4, 5, 3, 4, 4, 4, 4, 3, 4] as const;
const MENS_SI = [11, 9, 13, 7, 17, 1, 3, 15, 5, 6, 10, 18, 12, 14, 4, 2, 16, 8] as const;

function buildHoles(yards: readonly number[]): Hole[] {
  return yards.map((y, i) => ({
    hole: i + 1,
    par: MENS_PAR[i],
    si: MENS_SI[i],
    yards: y,
  }));
}

const BLACK_YARDS = [383, 365, 346, 576, 137, 538, 439, 177, 373, 408, 530, 145, 327, 373, 379, 445, 250, 366];
const BLUE_YARDS = [367, 353, 328, 517, 131, 521, 394, 168, 355, 350, 505, 128, 299, 351, 360, 413, 202, 355];
const BLUE_WHITE_YARDS = [367, 345, 297, 517, 125, 521, 371, 161, 345, 350, 482, 111, 244, 336, 360, 413, 182, 334];
const WHITE_YARDS = [357, 345, 297, 495, 125, 504, 371, 161, 345, 332, 482, 111, 244, 336, 347, 384, 182, 334];
const GREEN_YARDS = [342, 337, 287, 489, 120, 405, 363, 155, 335, 313, 449, 91, 230, 320, 315, 403, 172, 325];
const RED_YARDS = [342, 249, 287, 447, 115, 405, 286, 139, 240, 279, 415, 91, 189, 306, 255, 373, 172, 269];

const TEES: Tee[] = [
  { name: 'Black', rating: 72.9, slope: 139, color: '#222222', holes: buildHoles(BLACK_YARDS) },
  { name: 'Blue', rating: 70.9, slope: 135, color: '#00CCFF', holes: buildHoles(BLUE_YARDS) },
  { name: 'Blue/White', rating: 70.0, slope: 133, color: '#00CCFF', holes: buildHoles(BLUE_WHITE_YARDS) },
  { name: 'White', rating: 69.0, slope: 131, color: '#FFFFFF', holes: buildHoles(WHITE_YARDS) },
  { name: 'Green', rating: 67.8, slope: 129, color: '#66FF66', holes: buildHoles(GREEN_YARDS) },
  { name: 'Red', rating: 65.0, slope: 125, color: '#FF5050', holes: buildHoles(RED_YARDS) },
];

export const ASPETUCK_COURSE: Course = {
  id: 'aspetuck',
  name: 'Aspetuck Valley CC',
  location: 'Weston, CT',
  tees: TEES,
  holes: TEES[0].holes,
};
