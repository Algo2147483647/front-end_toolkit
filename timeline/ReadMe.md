# Timeline Atlas Data Spec (`v2`)

This document defines the recommended JSON structure for `timeline/example.json`.

## 1) Top-level structure

Use an object keyed by event ID.

```json
{
  "event_id_1": { "...event body..." },
  "event_id_2": { "...event body..." }
}
```

Rules:

- The outer key is the real event key. Do not repeat `key` inside the value.
- `parents` and `children` are arrays of event IDs (outer keys).

## 2) Event object

```json
{
  "time": { "...see section 3..." },
  "space": { "...see section 4..." },
  "data": {
    "event": "Human readable title"
  },
  "parents": [],
  "children": []
}
```

Fields:

- `time`: required, unified `period` object.
- `space`: optional, structured location object.
- `data`: optional, free metadata for UI details.
- `parents`: optional, default `[]`.
- `children`: optional, default `[]`.

## 3) `time` design (unified `period`)

`time` is always a period object.  
If an event is a point in time, use `start == end`.

```json
{
  "type": "year",
  "start": "3200 BCE",
  "end": "3200 BCE"
}
```

### 3.1 `time` fields

- `type`: time type of `start` (required). `end` must use the same type.
- `start`: period start (required).
- `end`: period end (required). Point event uses `start == end`.

### 3.2 `time.type` enum

- `year`: examples `3200 BCE`, `1948`
- `year_month`: example `1949-10`
- `date`: example `1949-10-01`
- `datetime`: ISO8601, example `2026-04-10T08:30:00+08:00`
- `text`: non-standard historical label, example `Late Bronze Age`

### 3.3 `time` examples

Point event (start=end):

```json
{
  "type": "year",
  "start": "1948",
  "end": "1948"
}
```

Range event:

```json
{
  "type": "year",
  "start": "1760",
  "end": "1914"
}
```

## 4) `space` design

```json
{
  "type": "latitude_and_longitude",
  "latitude": 121.123,
  "longitude": 121.123,
  "named_place": "Middle East"
}
```

### 4.1 `space` common fields

- `type`: required enum.
- `named_place`: optional canonical place label.
- `confidence`: optional enum.

### 4.2 `space.type` enum and fields

- `latitude_and_longitude`
- Required: `latitude`, `longitude`
- Optional: `altitude`, `radius_km`

- `named_place`
- Optional: `country`, `admin1`, `admin2`, `city`, `site`

- `bounding_box`
- Required: `north`, `south`, `east`, `west`

- `polygon`
- Required: `coordinates` (`[[lng, lat], ...]`, first and last point should close)

- `multi_location`
- Required: `locations` (array of `space` objects)

### 4.3 `space.confidence` enum

- `high`
- `medium`
- `low`

## 5) Full event example

```json
{
  "writing_systems": {
    "time": {
      "type": "year",
      "start": "3200 BCE",
      "end": "3200 BCE"
    },
    "space": {
      "type": "latitude_and_longitude",
      "latitude": 33.3152,
      "longitude": 44.3661,
      "named_place": "Middle East"
    },
    "data": {
      "event": "Birth of Writing Systems",
      "significance": "Transforms knowledge from oral tradition into durable records."
    },
    "parents": [],
    "children": ["legal_codes"]
  }
}
```

## 6) Compatibility note

Current renderer still supports legacy `time: []` and `space: []` formats.  
When migrating to `v2`, prefer writing data directly in this spec and then adapting parser/rendering in code.
