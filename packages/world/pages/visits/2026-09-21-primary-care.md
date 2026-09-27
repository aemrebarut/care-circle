# Primary care paperwork visit, September 21

All people, providers, records, and events on this page are fictional demo data. Care Circle organizes source records and does not recommend doses or treatments. Not medical advice.

Date: 2026-09-21. Patient: [[people/rose-alvarez]]. Doctor: [[doctors/primary-care]].

Attendees: [[people/ben-alvarez]].

## Source record

Ben brought the family notebook to primary care. Atorvastatin is recorded as 20 mg nightly. Vitamin D3 is recorded as 1000 IU daily. Acetaminophen is recorded as 500 mg once daily as needed for pain. No medication change is recorded. Ben asked the office to send the fictional referral attachment requested by the insurer.

Recorded follow-up: Office to confirm that the requested referral attachment was sent.

This is a fictional visit record, not a treatment instruction.

```care-circle-page
{
  "id": "visits/2026-09-21-primary-care",
  "type": "visit",
  "title": "Primary care paperwork visit, September 21",
  "fields": {
    "synthetic": true,
    "patientId": "people/rose-alvarez",
    "date": "2026-09-21",
    "doctorId": "doctors/primary-care",
    "attendeeIds": [
      "people/ben-alvarez"
    ],
    "summary": "Ben brought the family notebook to primary care. Atorvastatin is recorded as 20 mg nightly. Vitamin D3 is recorded as 1000 IU daily. Acetaminophen is recorded as 500 mg once daily as needed for pain. No medication change is recorded. Ben asked the office to send the fictional referral attachment requested by the insurer.",
    "medicationChanges": [],
    "followUps": [
      {
        "text": "Office to confirm that the requested referral attachment was sent."
      }
    ]
  },
  "links": [
    {
      "target": "doctors/primary-care",
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
