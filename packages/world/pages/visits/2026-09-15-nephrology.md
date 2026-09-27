# Nephrology visit, September 15

All people, providers, records, and events on this page are fictional demo data. Care Circle organizes source records and does not recommend doses or treatments. Not medical advice.

Date: 2026-09-15. Patient: [[people/rose-alvarez]]. Doctor: [[doctors/nephrologist]].

Attendees: [[people/celia-alvarez]].

## Source record

Celia attended the nephrology visit. Lisinopril is recorded as 10 mg daily. Amlodipine is recorded as 2.5 mg daily. The fictional source requested a chemistry lab draw for September 16 and listed the next nephrology appointment as September 29.

Recorded follow-up: Chemistry lab draw recorded in the source. Source target date: 2026-09-16.

Recorded follow-up: Next nephrology appointment on the family calendar. Source target date: 2026-09-29.

This is a fictional visit record, not a treatment instruction.

```care-circle-page
{
  "id": "visits/2026-09-15-nephrology",
  "type": "visit",
  "title": "Nephrology visit, September 15",
  "fields": {
    "synthetic": true,
    "patientId": "people/rose-alvarez",
    "date": "2026-09-15",
    "doctorId": "doctors/nephrologist",
    "attendeeIds": [
      "people/celia-alvarez"
    ],
    "summary": "Celia attended the nephrology visit. Lisinopril is recorded as 10 mg daily. Amlodipine is recorded as 2.5 mg daily. The fictional source requested a chemistry lab draw for September 16 and listed the next nephrology appointment as September 29.",
    "medicationChanges": [],
    "followUps": [
      {
        "text": "Chemistry lab draw recorded in the source.",
        "dueDate": "2026-09-16"
      },
      {
        "text": "Next nephrology appointment on the family calendar.",
        "dueDate": "2026-09-29"
      }
    ]
  },
  "links": [
    {
      "target": "doctors/nephrologist",
      "type": "mentions"
    },
    {
      "target": "people/celia-alvarez",
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
