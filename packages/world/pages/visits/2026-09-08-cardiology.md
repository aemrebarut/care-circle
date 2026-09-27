# Cardiology source review, September 8

All people, providers, records, and events on this page are fictional demo data. Care Circle organizes source records and does not recommend doses or treatments. Not medical advice.

Date: 2026-09-08. Patient: [[people/rose-alvarez]]. Doctor: [[doctors/cardiologist]].

Attendees: [[people/ana-alvarez]].

## Source record

Dr. Chen reviewed the family medication notebook with Ana. Lisinopril is recorded as 10 mg daily. Amlodipine is recorded as 2.5 mg daily. This visit records no medication change.

This is a fictional visit record, not a treatment instruction.

```care-circle-page
{
  "id": "visits/2026-09-08-cardiology",
  "type": "visit",
  "title": "Cardiology source review, September 8",
  "fields": {
    "synthetic": true,
    "patientId": "people/rose-alvarez",
    "date": "2026-09-08",
    "doctorId": "doctors/cardiologist",
    "attendeeIds": [
      "people/ana-alvarez"
    ],
    "summary": "Dr. Chen reviewed the family medication notebook with Ana. Lisinopril is recorded as 10 mg daily. Amlodipine is recorded as 2.5 mg daily. This visit records no medication change.",
    "medicationChanges": [],
    "followUps": []
  },
  "links": [
    {
      "target": "doctors/cardiologist",
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
