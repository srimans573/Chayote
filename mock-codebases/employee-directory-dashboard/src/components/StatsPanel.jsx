export default function StatsPanel({ employees }) {
  const activeEmployees = employees.filter((employee) => employee.isActive);

  return (
    <div>
      <h3>Statistics</h3>

      <p>Active Employees: {activeEmployees.length}</p>

      <p>Total Employees: {employees.length}</p>
    </div>
  );
}
