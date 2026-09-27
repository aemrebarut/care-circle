# Endocrinology visit, September 10

All people, providers, records, and events on this page are fictional demo data. Care Circle organizes source records and does not recommend doses or treatments. Not medical advice.

Date: 2026-09-10. Patient: [[people/rose-alvarez]]. Doctor: [[doctors/endocrinologist]].

Attendees: [[people/ben-alvarez]].

## Source record

Ben attended the endocrinology visit. Metformin is recorded as 500 mg twice daily. Levothyroxine is recorded as 50 mcg each morning. The source records an A1c sample on September 10 without an interpretation in this notebook.

Recorded follow-up: Keep the A1c source result with the visit notes.

This is a fictional visit record, not a treatment instruction.

```care-circle-page
{
  "id": "visits/2026-09-10-endocrinology",
  "type": "visit",
  "title": "Endocrinology visit, September 10",
  "fields": {
    "synthetic": true,
    "patientId": "people/rose-alvarez",
    "date": "2026-09-10",
    "doctorId": "doctors/endocrinologist",
    "attendeeIds": [
      "people/ben-alvarez"
    ],
    "summary": "Ben attended the endocrinology visit. Metformin is recorded as 500 mg twice daily. Levothyroxine is recorded as 50 mcg each morning. The source records an A1c sample on September 10 without an interpretation in this notebook.",
    "medicationChanges": [],
    "followUps": [
      {
        "text": "Keep the A1c source result with the visit notes."
      }
    ]
  },
  "links": [
    {
      "target": "doctors/endocrinologist",
      "type": "mentions"
    },
    {
      "target": "people/ben-alvarez",
      "type": "attended"
    },
    {
      "target": "people/rose-alvarez",
      "type": "mentions"
    }
  ],
  "updatedAt": "2026-09-27T12:00:00.000Z"
}
```
