export default function EmployeeCard({ employee }) {
  return (
    <div className="card">
      <h3>{employee.name}</h3>

      <p>{employee.department}</p>

      <p>Status: {employee.isActive ? "Active" : "Inactive"}</p>

      <p>Hired: {employee.hireDate}</p>
    </div>
  );
}
