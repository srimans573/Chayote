export async function fetchEmployees() {
  const response = await fetch("/api/employees");

  if (!response.ok) {
    throw new Error("Failed to load employees");
  }

  const employees = await response.json();

  return employees;
}
