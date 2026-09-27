# Amlodipine

All people, providers, records, and events on this page are fictional demo data. Care Circle organizes source records and does not recommend doses or treatments. Not medical advice.

## Recorded medication entry

Amlodipine is recorded as 5 mg daily in [[visits/2026-09-23-cardiology]]. This is a source claim, not a recommendation.

Status in the fictional source list: active.

## Source history

- 2026-09-03: 2.5 mg daily; visit source [[visits/2026-09-03-primary-care]]; family recorder or attendee [[people/ana-alvarez]].
- 2026-09-23: 5 mg daily; visit source [[visits/2026-09-23-cardiology]]; family recorder or attendee [[people/ana-alvarez]].
- 2026-09-24: 5 mg daily; pharmacy source [[pharmacy/2026-09-24-medication-record]]; family recorder or attendee [[people/ben-alvarez]].

Historical entries are retained. A changed visit entry does not erase a pharmacy source. The family notebook does not determine what Rose should take.

## Related source pages

[[people/rose-alvarez]].

```care-circle-page
{
  "id": "medications/amlodipine",
  "type": "medication",
  "title": "Amlodipine",
  "fields": {
    "synthetic": true,
    "patientId": "people/rose-alvarez",
    "name": "Amlodipine",
    "dose": "5 mg",
    "frequency": "daily",
    "status": "active",
    "claims": [
      {
        "dose": "2.5 mg",
        "frequency": "daily",
        "sourceId": "visits/2026-09-03-primary-care",
        "date": "2026-09-03",
        "attendeeIds": [
          "people/ana-alvarez"
        ],
        "kind": "visit"
      },
      {
        "dose": "5 mg",
        "frequency": "daily",
        "sourceId": "visits/2026-09-23-cardiology",
        "date": "2026-09-23",
        "attendeeIds": [
          "people/ana-alvarez"
        ],
        "kind": "visit"
      },
      {
        "dose": "5 mg",
        "frequency": "daily",
        "sourceId": "pharmacy/2026-09-24-medication-record",
        "date": "2026-09-24",
        "attendeeIds": [
          "people/ben-alvarez"
        ],
        "kind": "pharmacy"
      }
    ],
    "recordedSourceId": "visits/2026-09-23-cardiology",
    "asNeeded": false,
    "citations": [
      {
        "pageId": "visits/2026-09-03-primary-care",
        "title": "Primary care medication reconciliation, September 3",
        "quote": "Amlodipine is recorded as 2.5 mg daily.",
        "date": "2026-09-03",
        "attendeeIds": [
          "people/ana-alvarez"
        ]
      },
      {
        "pageId": "visits/2026-09-23-cardiology",
        "title": "Cardiology visit, September 23",
        "quote": "Amlodipine is recorded as 5 mg daily.",
        "date": "2026-09-23",
        "attendeeIds": [
          "people/ana-alvarez"
        ]
      },
      {
        "pageId": "pharmacy/2026-09-24-medication-record",
        "title": "Fictional pharmacy medication record, September 24",
        "quote": "Amlodipine: the pharmacy record lists 5 mg daily.",
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
      "target": "visits/2026-09-23-cardiology",
      "type": "mentions"
    }
  ],
  "updatedAt": "2026-09-27T12:00:00.000Z"
}
```
