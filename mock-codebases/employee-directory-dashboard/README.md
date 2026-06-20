# Employee Directory Dashboard

Welcome to the Employee Directory Dashboard project.

This internal tool is used by managers to browse employee information across
teams.

The application allows users to:

- Search employees
- Filter by department
- View employee status
- Sort by hire date
- See department statistics

## Reported Issues

The product team has reported the following concerns:

- Search sometimes misses expected results
- Employee status occasionally appears incorrect
- The dashboard becomes noticeably slower with large datasets
- Statistics do not always match displayed results
- Users have reported inconsistent behavior after changing filters

## Project Structure

```txt
backend/
├── app.py
├── requirements.txt
└── data/
    └── employees.py
src/
├── EmployeeDashboard.jsx
├── components/
│   ├── EmployeeCard.jsx
│   ├── SearchBar.jsx
│   └── StatsPanel.jsx
├── hooks/
│   └── useEmployees.js
├── utils/
│   └── employeeUtils.js
└── api.js
```

## Local API

The frontend calls `GET /api/employees`. The Python backend in `backend/app.py`
serves that endpoint and returns the sample employee data from
`backend/data/employees.py`.

## Candidate Task

Please explore the codebase and think aloud.

We are interested in:

- How you debug
- How you reason about data flow
- How you identify root causes
- How you evaluate tradeoffs

You do not need to rewrite the application. Focus on understanding the code
and proposing improvements.
