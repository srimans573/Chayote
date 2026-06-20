import { useEffect, useState } from "react";
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
