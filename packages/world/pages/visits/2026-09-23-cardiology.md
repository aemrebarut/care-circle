# Cardiology visit, September 23

All people, providers, records, and events on this page are fictional demo data. Care Circle organizes source records and does not recommend doses or treatments. Not medical advice.

Date: 2026-09-23. Patient: [[people/rose-alvarez]]. Doctor: [[doctors/cardiologist]].

Attendees: [[people/ana-alvarez]].

## Source record

Ana attended cardiology with Dr. Chen. Lisinopril is recorded as 10 mg daily. Amlodipine is recorded as 5 mg daily. The source records an amlodipine change from the earlier 2.5 mg daily entry. A follow-up cardiology appointment was placed on the family calendar for September 27.

Amlodipine: the visit records a change from 2.5 mg daily to 5 mg daily. Medication page: [[medications/amlodipine]].

Recorded follow-up: Family to bring the updated medication source list to nephrology.

This is a fictional visit record, not a treatment instruction.

```care-circle-page
{
  "id": "visits/2026-09-23-cardiology",
  "type": "visit",
  "title": "Cardiology visit, September 23",
  "fields": {
    "synthetic": true,
    "patientId": "people/rose-alvarez",
    "date": "2026-09-23",
    "doctorId": "doctors/cardiologist",
    "attendeeIds": [
      "people/ana-alvarez"
    ],
    "summary": "Ana attended cardiology with Dr. Chen. Lisinopril is recorded as 10 mg daily. Amlodipine is recorded as 5 mg daily. The source records an amlodipine change from the earlier 2.5 mg daily entry. A follow-up cardiology appointment was placed on the family calendar for September 27.",
    "medicationChanges": [
      {
        "medicationId": "medications/amlodipine",
        "name": "Amlodipine",
        "previousDose": "2.5 mg",
        "previousFrequency": "daily",
        "dose": "5 mg",
        "frequency": "daily"
      }
    ],
    "followUps": [
      {
        "text": "Family to bring the updated medication source list to nephrology."
      }
    ]
  },
  "links": [
    {
      "target": "doctors/cardiologist",
      "type": "mentions"
    },
    {
      "target": "medications/amlodipine",
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
