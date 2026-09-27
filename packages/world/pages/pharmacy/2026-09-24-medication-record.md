# Fictional pharmacy medication record, September 24

All people, providers, records, and events on this page are fictional demo data. Care Circle organizes source records and does not recommend doses or treatments. Not medical advice.

Date: 2026-09-24. Recorded by [[people/ben-alvarez]] for [[people/rose-alvarez]].

## Source record

Lisinopril: the pharmacy record lists 10 mg daily. [[medications/lisinopril]].

Amlodipine: the pharmacy record lists 5 mg daily. [[medications/amlodipine]].

Atorvastatin: the pharmacy record lists 20 mg nightly. [[medications/atorvastatin]].

Metformin: the pharmacy record lists 500 mg twice daily. [[medications/metformin]].

Levothyroxine: the pharmacy record lists 50 mcg each morning. [[medications/levothyroxine]].

Vitamin D3: the pharmacy record lists 1000 IU daily. [[medications/vitamin-d3]].

Acetaminophen: the pharmacy record lists 500 mg once daily as needed for pain. [[medications/acetaminophen]].

This fictional pharmacy list agrees with the latest visit claims at seed time. It is not proof of dispensing, adherence, or current administration. Later source discrepancies should be shown with both sources.

```care-circle-page
{
  "id": "pharmacy/2026-09-24-medication-record",
  "type": "pharmacy",
  "title": "Fictional pharmacy medication record, September 24",
  "fields": {
    "synthetic": true,
    "patientId": "people/rose-alvarez",
    "date": "2026-09-24",
    "recordedBy": "people/ben-alvarez",
    "attendeeIds": [
      "people/ben-alvarez"
    ],
    "pharmacyName": "Demo Circle Pharmacy",
    "records": [
      {
        "medicationId": "medications/lisinopril",
        "name": "Lisinopril",
        "dose": "10 mg",
        "frequency": "daily"
      },
      {
        "medicationId": "medications/amlodipine",
        "name": "Amlodipine",
        "dose": "5 mg",
        "frequency": "daily"
      },
      {
        "medicationId": "medications/atorvastatin",
        "name": "Atorvastatin",
        "dose": "20 mg",
        "frequency": "nightly"
      },
      {
        "medicationId": "medications/metformin",
        "name": "Metformin",
        "dose": "500 mg",
        "frequency": "twice daily"
      },
      {
        "medicationId": "medications/levothyroxine",
        "name": "Levothyroxine",
        "dose": "50 mcg",
        "frequency": "each morning"
      },
      {
        "medicationId": "medications/vitamin-d3",
        "name": "Vitamin D3",
        "dose": "1000 IU",
        "frequency": "daily"
      },
      {
        "medicationId": "medications/acetaminophen",
        "name": "Acetaminophen",
        "dose": "500 mg",
        "frequency": "once daily as needed for pain"
      }
    ],
    "recordKind": "pharmacy-record",
    "verifiesAdministration": false
  },
  "links": [
    {
      "target": "medications/acetaminophen",
      "type": "mentions"
    },
    {
      "target": "medications/amlodipine",
      "type": "mentions"
    },
    {
      "target": "medications/atorvastatin",
      "type": "mentions"
    },
    {
      "target": "medications/levothyroxine",
      "type": "mentions"
    },
    {
      "target": "medications/lisinopril",
      "type": "mentions"
    },
    {
      "target": "medications/metformin",
      "type": "mentions"
    },
    {
      "target": "medications/vitamin-d3",
      "type": "mentions"
    },
    {
      "target": "people/ben-alvarez",
      "type": "mentions"
    },
    {
      "target": "people/rose-alvarez",
      "type": "mentions"
    }
  ],
  "updatedAt": "2026-09-27T12:00:00.000Z"
}
```
