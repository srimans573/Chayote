import { useState } from "react";

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
