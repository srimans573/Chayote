do $$
begin
  create type public.frontend_technology as enum ('react_javascript');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.backend_technology as enum ('python');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.rubric_source as enum ('uploaded', 'generated');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.assessment_codebase_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(trim(slug)) >= 2),
  title text not null check (char_length(trim(title)) >= 2),
  description text not null default '',
  frontend_technology public.frontend_technology not null,
  backend_technology public.backend_technology not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_codebase_files (
  id uuid primary key default gen_random_uuid(),
  codebase_template_id uuid not null references public.assessment_codebase_templates(id) on delete cascade,
  path text not null check (char_length(trim(path)) >= 2),
  language text not null check (char_length(trim(language)) >= 2),
  content text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (codebase_template_id, path)
);

create table if not exists public.assessment_rubric_templates (
  id uuid primary key default gen_random_uuid(),
  codebase_template_id uuid not null references public.assessment_codebase_templates(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 2),
  content text not null,
  is_mock boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (codebase_template_id)
);

create index if not exists assessment_codebase_files_template_id_idx
on public.assessment_codebase_files (codebase_template_id, sort_order);

create index if not exists assessment_rubric_templates_template_id_idx
on public.assessment_rubric_templates (codebase_template_id);

alter table public.assessments
add column if not exists time_limit_minutes integer not null default 30;

alter table public.assessments
add column if not exists frontend_technology public.frontend_technology not null default 'react_javascript';

alter table public.assessments
add column if not exists backend_technology public.backend_technology not null default 'python';

alter table public.assessments
add column if not exists job_description text not null default '';

alter table public.assessments
add column if not exists codebase_template_id uuid;

alter table public.assessments
add column if not exists rubric_source public.rubric_source not null default 'generated';

alter table public.assessments
add column if not exists rubric_text text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assessments_time_limit_minutes_check'
  ) then
    alter table public.assessments
    add constraint assessments_time_limit_minutes_check
    check (
      time_limit_minutes >= 5
      and time_limit_minutes <= 240
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assessments_codebase_template_id_fkey'
  ) then
    alter table public.assessments
    add constraint assessments_codebase_template_id_fkey
    foreign key (codebase_template_id)
    references public.assessment_codebase_templates(id)
    on delete set null;
  end if;
end $$;

drop trigger if exists assessment_codebase_templates_set_updated_at on public.assessment_codebase_templates;
create trigger assessment_codebase_templates_set_updated_at
before update on public.assessment_codebase_templates
for each row
execute function public.set_updated_at();

drop trigger if exists assessment_codebase_files_set_updated_at on public.assessment_codebase_files;
create trigger assessment_codebase_files_set_updated_at
before update on public.assessment_codebase_files
for each row
execute function public.set_updated_at();

drop trigger if exists assessment_rubric_templates_set_updated_at on public.assessment_rubric_templates;
create trigger assessment_rubric_templates_set_updated_at
before update on public.assessment_rubric_templates
for each row
execute function public.set_updated_at();

alter table public.assessment_codebase_templates enable row level security;
alter table public.assessment_codebase_files enable row level security;
alter table public.assessment_rubric_templates enable row level security;

revoke all on public.assessment_codebase_templates from anon, authenticated;
revoke all on public.assessment_codebase_files from anon, authenticated;
revoke all on public.assessment_rubric_templates from anon, authenticated;

grant select on public.assessment_codebase_templates to authenticated;
grant select on public.assessment_codebase_files to authenticated;
grant select on public.assessment_rubric_templates to authenticated;
grant insert on public.assessments to authenticated;

drop policy if exists "Recruiters can create organization assessments" on public.assessments;
create policy "Recruiters can create organization assessments"
on public.assessments
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.recruiter_profiles
    where recruiter_profiles.id = auth.uid()
      and recruiter_profiles.organization_id = assessments.organization_id
      and recruiter_profiles.status = 'active'
  )
);

drop policy if exists "Recruiters can read active codebase templates" on public.assessment_codebase_templates;
create policy "Recruiters can read active codebase templates"
on public.assessment_codebase_templates
for select
to authenticated
using (
  is_active
  and exists (
    select 1
    from public.recruiter_profiles
    where recruiter_profiles.id = auth.uid()
      and recruiter_profiles.status = 'active'
  )
);

drop policy if exists "Recruiters can read active codebase files" on public.assessment_codebase_files;
create policy "Recruiters can read active codebase files"
on public.assessment_codebase_files
for select
to authenticated
using (
  exists (
    select 1
    from public.assessment_codebase_templates
    join public.recruiter_profiles
      on recruiter_profiles.id = auth.uid()
     and recruiter_profiles.status = 'active'
    where assessment_codebase_templates.id = assessment_codebase_files.codebase_template_id
      and assessment_codebase_templates.is_active
  )
);

drop policy if exists "Recruiters can read active rubric templates" on public.assessment_rubric_templates;
create policy "Recruiters can read active rubric templates"
on public.assessment_rubric_templates
for select
to authenticated
using (
  exists (
    select 1
    from public.assessment_codebase_templates
    join public.recruiter_profiles
      on recruiter_profiles.id = auth.uid()
     and recruiter_profiles.status = 'active'
    where assessment_codebase_templates.id = assessment_rubric_templates.codebase_template_id
      and assessment_codebase_templates.is_active
  )
);

with upserted_template as (
  insert into public.assessment_codebase_templates (
    slug,
    title,
    description,
    frontend_technology,
    backend_technology,
    is_active
  )
  values (
    'employee-directory-dashboard',
    'Employee Directory Dashboard',
    'A miniature React code review where candidates investigate employee search, filtering, status, sorting, statistics, performance, and UX issues.',
    'react_javascript',
    'python',
    true
  )
  on conflict (slug) do update
  set
    title = excluded.title,
    description = excluded.description,
    frontend_technology = excluded.frontend_technology,
    backend_technology = excluded.backend_technology,
    is_active = excluded.is_active,
    updated_at = now()
  returning id
)
insert into public.assessment_codebase_files (
  codebase_template_id,
  path,
  language,
  content,
  sort_order
)
select
  upserted_template.id,
  files.path,
  files.language,
  files.content,
  files.sort_order
from upserted_template
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
      'src/api.js',
      'javascript',
$file$export async function fetchEmployees() {
  const response = await fetch("/api/employees");

  if (!response.ok) {
    throw new Error("Failed to load employees");
  }

  const employees = await response.json();

  return employees;
}
$file$,
      1
    ),
    (
      'src/hooks/useEmployees.js',
      'javascript',
$file$import { useEffect, useState } from "react";
import { fetchEmployees } from "../api";

export function useEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    setLoading(true);

    const data = await fetchEmployees();

    setEmployees(data);
    setLoading(false);
  }

  return {
    employees,
    loading,
  };
}
$file$,
      2
    ),
    (
      'src/utils/employeeUtils.js',
      'javascript',
$file$export function sortEmployees(employees) {
  return employees.sort(
    (a, b) => new Date(b.hireDate) - new Date(a.hireDate),
  );
}

export function countDepartments(employees) {
  const counts = {};

  employees.forEach((employee) => {
    counts[employee.department] =
      (counts[employee.department] || 0) + 1;
  });

  return counts;
}
$file$,
      3
    ),
    (
      'src/components/SearchBar.jsx',
      'jsx',
$file$export default function SearchBar({ query, onChange }) {
  return (
    <input
      value={query}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search employees"
    />
  );
}
$file$,
      4
    ),
    (
      'src/components/StatsPanel.jsx',
      'jsx',
$file$export default function StatsPanel({ employees }) {
  const activeEmployees = employees.filter((employee) => employee.isActive);

  return (
    <div>
      <h3>Statistics</h3>

      <p>Active Employees: {activeEmployees.length}</p>

      <p>Total Employees: {employees.length}</p>
    </div>
  );
}
$file$,
      5
    ),
    (
      'src/components/EmployeeCard.jsx',
      'jsx',
$file$export default function EmployeeCard({ employee }) {
  return (
    <div className="card">
      <h3>{employee.name}</h3>

      <p>{employee.department}</p>

      <p>Status: {employee.isActive ? "Active" : "Inactive"}</p>

      <p>Hired: {employee.hireDate}</p>
    </div>
  );
}
$file$,
      6
    ),
    (
      'src/EmployeeDashboard.jsx',
      'jsx',
$file$import { useState } from "react";

import EmployeeCard from "./components/EmployeeCard";
import SearchBar from "./components/SearchBar";
import StatsPanel from "./components/StatsPanel";

import { useEmployees } from "./hooks/useEmployees";

import {
  countDepartments,
  sortEmployees,
} from "./utils/employeeUtils";

export default function EmployeeDashboard() {
  const { employees, loading } = useEmployees();

  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");

  const filteredEmployees = employees.filter((employee) => {
    const matchesName = employee.name.includes(query);

    const matchesDepartment =
      department === "all" || employee.department === department;

    return matchesName && matchesDepartment;
  });

  const sortedEmployees = sortEmployees(filteredEmployees);

  const departmentStats = countDepartments(employees);

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <h1>Employee Directory</h1>

      <SearchBar query={query} onChange={setQuery} />

      <select
        value={department}
        onChange={(event) => setDepartment(event.target.value)}
      >
        <option value="all">All</option>
        <option value="Engineering">Engineering</option>
        <option value="Design">Design</option>
        <option value="Product">Product</option>
      </select>

      <StatsPanel employees={sortedEmployees} />

      <h2>Departments</h2>

      {Object.entries(departmentStats).map(([name, count]) => (
        <p key={name}>
          {name}: {count}
        </p>
      ))}

      {sortedEmployees.map((employee) => {
        const coworkers = employees.filter(
          (entry) => entry.department === employee.department,
        ).length;

        return (
          <EmployeeCard
            key={Math.random()}
            employee={{
              ...employee,
              coworkers,
            }}
          />
        );
      })}
    </div>
  );
}
$file$,
      7
    )
) as files(path, language, content, sort_order)
on conflict (codebase_template_id, path) do update
set
  language = excluded.language,
  content = excluded.content,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.assessment_rubric_templates (
  codebase_template_id,
  title,
  content,
  is_mock
)
select
  assessment_codebase_templates.id,
  'Employee Directory Dashboard Rubric',
$rubric$# Employee Directory Dashboard Rubric

Score candidates across six dimensions:

- Code Navigation
- Debugging
- React Knowledge
- Performance Reasoning
- Product Thinking
- Communication Quality

## Interview Flow

1. Exploration: ask the candidate to explain each file's responsibility.
2. Architecture: ask what happens from page load until employee cards appear.
3. Bug Investigation: ask why searching for `john` might miss John Smith.
4. Data Integrity: ask why inactive employees may appear active.
5. Performance: ask what changes with 50,000 employees.
6. React Knowledge: ask about `Math.random()` as a list key.
7. Hidden Bug: ask about odd ordering after changing department filters.
8. Product Thinking: ask what would change if this became customer-facing.
9. Seniority Stretch: ask how to design real-time employee updates.

## Expected Signals

- Traces data flow through `useEffect`, `fetchEmployees`, state, filtering,
  sorting, and rendering.
- Notices case sensitivity and whitespace handling in search.
- Discusses boolean normalization for employee status.
- Spots repeated filtering, O(n^2) coworker counting, and missing memoization.
- Identifies `Array.sort` mutation and unstable React keys.
- Prioritizes issues by product impact instead of technical novelty.
$rubric$,
  true
from public.assessment_codebase_templates
where assessment_codebase_templates.slug = 'employee-directory-dashboard'
on conflict (codebase_template_id) do update
set
  title = excluded.title,
  content = excluded.content,
  is_mock = excluded.is_mock,
  updated_at = now();
