# Primary care medication reconciliation, September 3

All people, providers, records, and events on this page are fictional demo data. Care Circle organizes source records and does not recommend doses or treatments. Not medical advice.

Date: 2026-09-03. Patient: [[people/rose-alvarez]]. Doctor: [[doctors/primary-care]].

Attendees: [[people/ana-alvarez]].

## Source record

Lisinopril is recorded as 10 mg daily. Amlodipine is recorded as 2.5 mg daily. Atorvastatin is recorded as 20 mg nightly. Metformin is recorded as 500 mg twice daily. Levothyroxine is recorded as 50 mcg each morning. Vitamin D3 is recorded as 1000 IU daily. Acetaminophen is recorded as 500 mg once daily as needed for pain. Ana copied these entries from the fictional visit medication list. No administration log is available.

Recorded follow-up: Bring the family medication notebook to the next specialist visit.

This is a fictional visit record, not a treatment instruction.

```care-circle-page
{
  "id": "visits/2026-09-03-primary-care",
  "type": "visit",
  "title": "Primary care medication reconciliation, September 3",
  "fields": {
    "synthetic": true,
    "patientId": "people/rose-alvarez",
    "date": "2026-09-03",
    "doctorId": "doctors/primary-care",
    "attendeeIds": [
      "people/ana-alvarez"
    ],
    "summary": "Lisinopril is recorded as 10 mg daily. Amlodipine is recorded as 2.5 mg daily. Atorvastatin is recorded as 20 mg nightly. Metformin is recorded as 500 mg twice daily. Levothyroxine is recorded as 50 mcg each morning. Vitamin D3 is recorded as 1000 IU daily. Acetaminophen is recorded as 500 mg once daily as needed for pain. Ana copied these entries from the fictional visit medication list. No administration log is available.",
    "medicationChanges": [],
    "followUps": [
      {
        "text": "Bring the family medication notebook to the next specialist visit."
      }
    ]
  },
  "links": [
    {
      "target": "doctors/primary-care",
      "type": "mentions"
    },
    {
      "target": "people/ana-alvarez",
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
