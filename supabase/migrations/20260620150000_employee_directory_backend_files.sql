update public.assessment_codebase_templates
set
  description = 'A miniature React and Python code review where candidates investigate employee search, filtering, status, sorting, statistics, performance, UX, and API data-shape issues.',
  technologies = array['react_javascript', 'python']::public.assessment_technology[],
  updated_at = now()
where slug = 'employee-directory-dashboard';

with template as (
  select id
  from public.assessment_codebase_templates
  where slug = 'employee-directory-dashboard'
)
insert into public.assessment_codebase_files (
  codebase_template_id,
  path,
  language,
  content,
  sort_order
)
select
  template.id,
  files.path,
  files.language,
  files.content,
  files.sort_order
from template
cross join (
  values
    (
      'README.md',
      'markdown',
$file$# Employee Directory Dashboard

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
$file$,
      0
    ),
    (
      'backend/requirements.txt',
      'text',
$file$fastapi==0.115.6
uvicorn==0.34.0
$file$,
      1
    ),
    (
      'backend/data/employees.py',
      'python',
$file$EMPLOYEES = [
    {
        "id": "emp-101",
        "name": "John Smith",
        "department": "Engineering",
        "hireDate": "2022-04-12",
        "isActive": True,
    },
    {
        "id": "emp-102",
        "name": "Maya Patel",
        "department": "Design",
        "hireDate": "2021-09-03",
        "isActive": "false",
    },
    {
        "id": "emp-103",
        "name": "Chris Nguyen",
        "department": "Product",
        "hireDate": "2023-01-18",
        "isActive": True,
    },
    {
        "id": "emp-104",
        "name": "Ari Johnson",
        "department": "Engineering",
        "hireDate": "2020-11-21",
        "isActive": False,
    },
]
$file$,
      2
    ),
    (
      'backend/app.py',
      'python',
$file$from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from data.employees import EMPLOYEES

app = FastAPI(title="Employee Directory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/employees")
def list_employees():
    return EMPLOYEES
$file$,
      3
    )
) as files(path, language, content, sort_order)
on conflict (codebase_template_id, path) do update
set
  language = excluded.language,
  content = excluded.content,
  sort_order = excluded.sort_order,
  updated_at = now();

update public.assessment_codebase_files
set
  sort_order = case path
    when 'README.md' then 0
    when 'backend/requirements.txt' then 1
    when 'backend/data/employees.py' then 2
    when 'backend/app.py' then 3
    when 'src/api.js' then 4
    when 'src/hooks/useEmployees.js' then 5
    when 'src/utils/employeeUtils.js' then 6
    when 'src/components/SearchBar.jsx' then 7
    when 'src/components/StatsPanel.jsx' then 8
    when 'src/components/EmployeeCard.jsx' then 9
    when 'src/EmployeeDashboard.jsx' then 10
    else sort_order
  end,
  updated_at = now()
from public.assessment_codebase_templates
where assessment_codebase_templates.id = assessment_codebase_files.codebase_template_id
  and assessment_codebase_templates.slug = 'employee-directory-dashboard';
