export function sortEmployees(employees) {
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
