# golfapi.io API Field Mapping

## Authentication
All requests require this header:
```
Authorization: Bearer {API_KEY}
```
API key is stored in .env as `GOLFAPI_KEY`. Never use X-API-Key — that doesn't work.

## Base URL
```
https://www.golfapi.io/api/v2.3
```

---

## Endpoint 1 — Search clubs by name
```
GET /clubs?name={query}&limit={n}
```

### Response structure
```json
{
  "apiRequestsLeft": "19.8",
  "numClubs": 1,
  "numAllClubs": 1,
  "clubs": [
    {
      "clubID": "141520610521982694",
      "clubName": "Aspetuck Valley Country Club",
      "city": "Weston",
      "state": "CT",
      "country": "USA",
      "address": "67 Old Redding Road",
      "timestampUpdated": "1742731220",
      "distance": "",
      "courses": [
        {
          "courseID": "012141520679645759931",
          "courseName": "Aspetuck Valley",
          "numHoles": 18,
          "timestampUpdated": "1742731220",
          "hasGPS": 1
        }
      ]
    }
  ]
}
```

### Field mapping for course list UI
| Our model | API field |
|-----------|-----------|
| id | `courses[0].courseID` |
| clubId | `clubID` |
| name | `clubName` (use for display; courseName is just the course within the club) |
| courseName | `courses[0].courseName` |
| location | `city + ", " + state` |
| distance | `distance` (empty string if not a geo search) |

**Note:** A club can have multiple courses. For MVP, always use `courses[0]` since most clubs have one course. Display `clubName` to the user, pass `courses[0].courseID` to the detail endpoint.

---

## Endpoint 2 — Search clubs by location (near me)
```
GET /clubs?lat={latitude}&lng={longitude}&limit=5
```
Same response structure as name search. `distance` field will be populated with miles from the user's location.

---

## Endpoint 3 — Course detail
```
GET /courses/{courseID}
```

### Response structure (real field names confirmed)
```json
{
  "apiRequestsLeft": "18.8",
  "clubID": "141520610521982694",
  "clubName": "Aspetuck Valley Country Club",
  "city": "Weston",
  "state": "CT",
  "country": "USA",
  "latitude": "41.2269177",
  "longitude": "-73.3325171",
  "courseID": "012141520679645759931",
  "courseName": "Aspetuck Valley",
  "numHoles": "18",
  "measure": "y",
  "parsMen": [4,4,4,5,3,5,4,3,4,4,5,3,4,4,4,4,3,4],
  "indexesMen": [11,9,13,7,17,1,3,15,5,6,10,18,12,14,4,2,16,8],
  "parsWomen": [4,4,4,5,3,5,4,3,4,4,5,3,4,4,4,4,3,4],
  "indexesWomen": [9,3,13,7,17,11,5,15,1,8,10,18,12,2,6,14,16,4],
  "numTees": 5,
  "tees": [
    {
      "teeID": "109362",
      "teeName": "Blue",
      "teeColor": "#00CCFF",
      "length1": 365,
      "length2": 349,
      ...
      "length18": 361,
      "courseRatingMen": 69.3,
      "slopeMen": 128,
      "courseRatingWomen": "",
      "slopeWomen": ""
    }
  ]
}
```

### Field mapping for our Course model
```typescript
// Build holes array from parsMen + indexesMen + tee lengths
const holes = parsMen.map((par, i) => ({
  hole: i + 1,
  par: par,
  si: indexesMen[i],
  yards: selectedTee[`length${i + 1}`]  // e.g. length1, length2, ... length18
}));

// Build tees array
const tees = apiResponse.tees
  .filter(t => t.courseRatingMen && t.slopeMen)  // skip tees with no men's rating
  .map(t => ({
    name: t.teeName,
    rating: parseFloat(t.courseRatingMen),
    slope: parseInt(t.slopeMen),
    color: t.teeColor
  }));

// Course object
const course = {
  id: apiResponse.courseID,
  name: apiResponse.clubName,  // use clubName for display (e.g. "Aspetuck Valley Country Club")
  location: `${apiResponse.city}, ${apiResponse.state}`,
  tees,
  holes  // will be rebuilt when user selects a tee
};
```

### Important notes on holes
- `parsMen` is an 18-element array, index 0 = hole 1
- `indexesMen` is an 18-element array, index 0 = hole 1 (stroke indexes)
- Yardages are per-tee: `length1` through `length18` on each tee object
- Holes must be rebuilt when the user changes tees (yards change per tee)
- Always use `parsMen` and `indexesMen` regardless of player gender for MVP

### Tee filtering
- Skip tees where `courseRatingMen` is empty string — these are women-only tees
- For Aspetuck this removes the Red tee from the men's selection
- `teeColor` is a hex string (e.g. `#00CCFF`) — use directly, no inference needed

---

## Stroke index fallback
If `indexesMen` contains all zeros or is missing, fall back to sequential (hole 1 = SI 1, etc.) and show the warning per the course selection brief.

---

## API call budget
- Trial: 20 calls total, non-expiring within trial period
- Each search = 1 call, each course detail = 1 call
- Cache everything in AsyncStorage — never call the same courseID twice
- Cache key format: `course:{courseID}`
- Also cache club search results: `search:name:{query}` and `search:geo:{lat},{lng}`

---

## Updated .env
```
GOLFAPI_KEY=6eb5787c-8c90-49af-9d86-abf630081069
```
Pass as: `Authorization: Bearer ${process.env.GOLFAPI_KEY}`
