flowchart TD
    A["Start"] --> B{"User Logged In?"}
    B -- No --> C["Login Page"]
    C -- Credentials Submitted --> D{"Authentication Successful?"}
    D -- Yes --> E["Job Vacancies Dashboard"]
    D -- No --> C
    B -- Yes --> E
    E --> F{"Select a Job Vacancy"}
    F --> G["Applicants Dashboard for Selected Job"]
    G --> H{"Select an Applicant"}
    H --> I["Applicant Detail View"]
    I --> J["View Scoring Results"]
    J --> K{"Take Action on Applicant"}
    K -- "Shortlist/Reject/Etc." --> G
    K -- View Another Applicant --> G
    E -- Logout --> L["Logout Processed"]
    G -- Logout --> L
    I -- Logout --> L
    J -- Logout --> L
    L --> A