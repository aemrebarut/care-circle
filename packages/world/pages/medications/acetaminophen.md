# Acetaminophen

All people, providers, records, and events on this page are fictional demo data. Care Circle organizes source records and does not recommend doses or treatments. Not medical advice.

## Recorded medication entry

Acetaminophen is recorded as 500 mg once daily as needed for pain in [[visits/2026-09-21-primary-care]]. This is a source claim, not a recommendation.

Status in the fictional source list: active; as-needed use is recorded, not scheduled administration.

## Source history

- 2026-09-03: 500 mg once daily as needed for pain; visit source [[visits/2026-09-03-primary-care]]; family recorder or attendee [[people/ana-alvarez]].
- 2026-09-21: 500 mg once daily as needed for pain; visit source [[visits/2026-09-21-primary-care]]; family recorder or attendee [[people/ben-alvarez]].
- 2026-09-24: 500 mg once daily as needed for pain; pharmacy source [[pharmacy/2026-09-24-medication-record]]; family recorder or attendee [[people/ben-alvarez]].

Historical entries are retained. A changed visit entry does not erase a pharmacy source. The family notebook does not determine what Rose should take.

## Related source pages

[[people/rose-alvarez]].

```care-circle-page
{
  "id": "medications/acetaminophen",
  "type": "medication",
  "title": "Acetaminophen",
  "fields": {
    "synthetic": true,
    "patientId": "people/rose-alvarez",
    "name": "Acetaminophen",
    "dose": "500 mg",
    "frequency": "once daily as needed for pain",
    "status": "active",
    "claims": [
      {
        "dose": "500 mg",
        "frequency": "once daily as needed for pain",
        "sourceId": "visits/2026-09-03-primary-care",
        "date": "2026-09-03",
        "attendeeIds": [
          "people/ana-alvarez"
        ],
        "kind": "visit"
      },
      {
        "dose": "500 mg",
        "frequency": "once daily as needed for pain",
        "sourceId": "visits/2026-09-21-primary-care",
        "date": "2026-09-21",
        "attendeeIds": [
          "people/ben-alvarez"
        ],
        "kind": "visit"
      },
      {
        "dose": "500 mg",
        "frequency": "once daily as needed for pain",
        "sourceId": "pharmacy/2026-09-24-medication-record",
        "date": "2026-09-24",
        "attendeeIds": [
          "people/ben-alvarez"
        ],
        "kind": "pharmacy"
      }
    ],
    "recordedSourceId": "visits/2026-09-21-primary-care",
    "asNeeded": true,
    "citations": [
      {
        "pageId": "visits/2026-09-03-primary-care",
        "title": "Primary care medication reconciliation, September 3",
        "quote": "Acetaminophen is recorded as 500 mg once daily as needed for pain.",
        "date": "2026-09-03",
        "attendeeIds": [
          "people/ana-alvarez"
        ]
      },
      {
        "pageId": "visits/2026-09-21-primary-care",
        "title": "Primary care paperwork visit, September 21",
        "quote": "Acetaminophen is recorded as 500 mg once daily as needed for pain.",
        "date": "2026-09-21",
        "attendeeIds": [
          "people/ben-alvarez"
        ]
      },
      {
        "pageId": "pharmacy/2026-09-24-medication-record",
        "title": "Fictional pharmacy medication record, September 24",
        "quote": "Acetaminophen: the pharmacy record lists 500 mg once daily as needed for pain.",
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
