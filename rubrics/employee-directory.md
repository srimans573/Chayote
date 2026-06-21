## Q1: API Layer
Ask: Walk me through what fetchEmployees does and whether anything could go wrong.
Pass: Identifies response.ok check, explains the thrown error, notes that JSON structure is not validated after parsing
Partial: Understands the fetch flow but misses the lack of schema validation
Fail: Cannot explain what the function does or where errors are handled

## Q2: Data Flow
Ask: How does the data from fetchEmployees get to the UI?
Pass: Traces the path through useEmployees.js hook into EmployeeDashboard.jsx, explains how state updates trigger re-renders
Partial: Knows a hook is involved but unclear on how state connects to components
Fail: Cannot explain the connection between the API call and what is displayed

## Q3: Search & Filter Bugs
Ask: The product team says search sometimes misses results. Where would you look first?
Pass: Points to SearchBar.jsx or employeeUtils.js, identifies case sensitivity or whitespace as likely culprits, proposes a concrete fix
Partial: Identifies the right files but cannot pinpoint the specific issue
Fail: No idea where to start or guesses randomly

## Q4: Stats Inconsistency
Ask: Statistics do not always match what is displayed. What could cause that?
Pass: Identifies that StatsPanel.jsx may be computing from a different data slice than the filtered list, mentions stale state or separate fetch
Partial: Suspects a state mismatch but cannot locate it in the code
Fail: Cannot explain how StatsPanel.jsx gets its data

## Q5: Performance
Ask: The dashboard slows down with large datasets. What would you do?
Pass: Mentions pagination or virtualization, identifies re-render cost of filtering on every keystroke, suggests debouncing SearchBar input
Partial: Knows it is a rendering issue but no concrete solution
Fail: No awareness of why large lists are expensive to render
