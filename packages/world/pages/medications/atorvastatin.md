# Atorvastatin

All people, providers, records, and events on this page are fictional demo data. Care Circle organizes source records and does not recommend doses or treatments. Not medical advice.

## Recorded medication entry

Atorvastatin is recorded as 20 mg nightly in [[visits/2026-09-21-primary-care]]. This is a source claim, not a recommendation.

Status in the fictional source list: active.

## Source history

- 2026-09-03: 20 mg nightly; visit source [[visits/2026-09-03-primary-care]]; family recorder or attendee [[people/ana-alvarez]].
- 2026-09-21: 20 mg nightly; visit source [[visits/2026-09-21-primary-care]]; family recorder or attendee [[people/ben-alvarez]].
- 2026-09-24: 20 mg nightly; pharmacy source [[pharmacy/2026-09-24-medication-record]]; family recorder or attendee [[people/ben-alvarez]].

Historical entries are retained. A changed visit entry does not erase a pharmacy source. The family notebook does not determine what Rose should take.

## Related source pages

[[people/rose-alvarez]].

```care-circle-page
{
  "id": "medications/atorvastatin",
  "type": "medication",
  "title": "Atorvastatin",
  "fields": {
    "synthetic": true,
    "patientId": "people/rose-alvarez",
    "name": "Atorvastatin",
    "dose": "20 mg",
    "frequency": "nightly",
    "status": "active",
    "claims": [
      {
        "dose": "20 mg",
        "frequency": "nightly",
        "sourceId": "visits/2026-09-03-primary-care",
        "date": "2026-09-03",
        "attendeeIds": [
          "people/ana-alvarez"
        ],
        "kind": "visit"
      },
      {
        "dose": "20 mg",
        "frequency": "nightly",
        "sourceId": "visits/2026-09-21-primary-care",
        "date": "2026-09-21",
        "attendeeIds": [
          "people/ben-alvarez"
        ],
        "kind": "visit"
      },
      {
        "dose": "20 mg",
        "frequency": "nightly",
        "sourceId": "pharmacy/2026-09-24-medication-record",
        "date": "2026-09-24",
        "attendeeIds": [
          "people/ben-alvarez"
        ],
        "kind": "pharmacy"
      }
    ],
    "recordedSourceId": "visits/2026-09-21-primary-care",
    "asNeeded": false,
    "citations": [
      {
        "pageId": "visits/2026-09-03-primary-care",
        "title": "Primary care medication reconciliation, September 3",
        "quote": "Atorvastatin is recorded as 20 mg nightly.",
        "date": "2026-09-03",
        "attendeeIds": [
          "people/ana-alvarez"
        ]
      },
      {
        "pageId": "visits/2026-09-21-primary-care",
        "title": "Primary care paperwork visit, September 21",
        "quote": "Atorvastatin is recorded as 20 mg nightly.",
        "date": "2026-09-21",
        "attendeeIds": [
          "people/ben-alvarez"
        ]
      },
      {
        "pageId": "pharmacy/2026-09-24-medication-record",
        "title": "Fictional pharmacy medication record, September 24",
        "quote": "Atorvastatin: the pharmacy record lists 20 mg nightly.",
        "date": "2026-09-24",
        "attendeeIds": [
          "people/ben-alvarez"
        ]
      }
    ]
  },
  "links": [
    {
      "target": "people/ana-alvarez",
      "type": "mentions"
    },
    {
      "target": "people/ben-alvarez",
      "type": "mentions"
    },
    {
      "target": "people/rose-alvarez",
      "type": "mentions"
    },
    {
      "target": "pharmacy/2026-09-24-medication-record",
      "type": "mentions"
    },
    {
      "target": "visits/2026-09-03-primary-care",
      "type": "mentions"
    },
    {
      "target": "visits/2026-09-21-primary-care",
      "type": "mentions"
    }
  ],
  "updatedAt": "2026-09-27T12:00:00.000Z"
}
```
