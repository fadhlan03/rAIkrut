graph TD
    subgraph User Interaction
        A[User's Browser] <--> B[Next.js Frontend Components]
    end

    subgraph Hosting_Platform
        B <--> C{Next.js Application Server}
    end

    subgraph Next.js_Application_Server
        C --> D[API Routes / Backend Logic]
        D <--> E[PDF Parsing Service]
        D <--> F[Scoring Engine]
    end

    subgraph Backend_Services
        D <--> G[(PostgreSQL Database)]
        E --> H[(File Storage for Resumes e.g., S3/Vercel Blob)]
        F <--> G
        D --> H
    end

    %% Styling (Optional)
    classDef frontend fill:#f9f,stroke:#333,stroke-width:2px;
    classDef backend fill:#ccf,stroke:#333,stroke-width:2px;
    classDef service fill:#cfc,stroke:#333,stroke-width:2px;
    classDef storage fill:#fcf,stroke:#333,stroke-width:2px;

    class A,B frontend;
    class C,D backend;
    class E,F service;
    class G,H storage;
