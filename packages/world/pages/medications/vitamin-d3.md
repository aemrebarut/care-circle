# Vitamin D3

All people, providers, records, and events on this page are fictional demo data. Care Circle organizes source records and does not recommend doses or treatments. Not medical advice.

## Recorded medication entry

Vitamin D3 is recorded as 1000 IU daily in [[visits/2026-09-21-primary-care]]. This is a source claim, not a recommendation.

Status in the fictional source list: active.

## Source history

- 2026-09-03: 1000 IU daily; visit source [[visits/2026-09-03-primary-care]]; family recorder or attendee [[people/ana-alvarez]].
- 2026-09-21: 1000 IU daily; visit source [[visits/2026-09-21-primary-care]]; family recorder or attendee [[people/ben-alvarez]].
- 2026-09-24: 1000 IU daily; pharmacy source [[pharmacy/2026-09-24-medication-record]]; family recorder or attendee [[people/ben-alvarez]].

Historical entries are retained. A changed visit entry does not erase a pharmacy source. The family notebook does not determine what Rose should take.

## Related source pages

[[people/rose-alvarez]].

```care-circle-page
{
  "id": "medications/vitamin-d3",
  "type": "medication",
  "title": "Vitamin D3",
  "fields": {
    "synthetic": true,
    "patientId": "people/rose-alvarez",
    "name": "Vitamin D3",
    "dose": "1000 IU",
    "frequency": "daily",
    "status": "active",
    "claims": [
      {
        "dose": "1000 IU",
        "frequency": "daily",
        "sourceId": "visits/2026-09-03-primary-care",
        "date": "2026-09-03",
        "attendeeIds": [
          "people/ana-alvarez"
        ],
        "kind": "visit"
      },
      {
        "dose": "1000 IU",
        "frequency": "daily",
        "sourceId": "visits/2026-09-21-primary-care",
        "date": "2026-09-21",
        "attendeeIds": [
          "people/ben-alvarez"
        ],
        "kind": "visit"
      },
      {
        "dose": "1000 IU",
        "frequency": "daily",
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
        "quote": "Vitamin D3 is recorded as 1000 IU daily.",
        "date": "2026-09-03",
        "attendeeIds": [
          "people/ana-alvarez"
        ]
      },
      {
        "pageId": "visits/2026-09-21-primary-care",
        "title": "Primary care paperwork visit, September 21",
        "quote": "Vitamin D3 is recorded as 1000 IU daily.",
        "date": "2026-09-21",
        "attendeeIds": [
          "people/ben-alvarez"
        ]
      },
      {
        "pageId": "pharmacy/2026-09-24-medication-record",
        "title": "Fictional pharmacy medication record, September 24",
        "quote": "Vitamin D3: the pharmacy record lists 1000 IU daily.",
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
