export default function SearchBar({ query, onChange }) {
  return (
    <input
      value={query}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search employees"
    />
  );
}
