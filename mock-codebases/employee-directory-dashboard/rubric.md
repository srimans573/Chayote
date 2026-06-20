# Employee Directory Dashboard Rubric

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
