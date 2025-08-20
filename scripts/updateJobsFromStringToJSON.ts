import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { jobVacancies } from '../src/db/schema.js'; // Adjust path if your schema is elsewhere
// import path from 'path'; // path is no longer used directly for env loading
import { eq } from 'drizzle-orm';

// Load environment variables
// The script will attempt to load from .env if DATABASE_URL is not already set
dotenv.config();

// Helper function to split text into an array of strings (sentences/bullet points)
const parseTextToArray = (text: string | undefined | null): string[] => {
  if (!text) {
    return [];
  }
  // Split by common delimiters for sentences or list items.
  // This can be refined further based on the actual text structure.
  const delimiters = /[\.\?!;\n•●▪►*+-](?=\s|$)/g;
  return text.split(delimiters).map(s => s.trim()).filter(s => s.length > 0);
};

// Hardcoded data from CSV
const jobsDataFromCSV = [
  { id: "684e7305-1805-4e8e-b28e-6e1bb2f1f5ea", raw_requirements: "5+ years of experience in frontend development. Proficiency in React, Redux/Zustand, Next.js, TypeScript, HTML5, CSS3. Experience with RESTful APIs and GraphQL. Strong understanding of web performance optimization. Excellent problem-solving and communication skills.", raw_job_desc: "Develop and maintain responsive web applications using React, Next.js, and TypeScript. Collaborate with product managers, designers, and backend engineers. Write clean, testable, and maintainable code. Mentor junior developers and contribute to code reviews." },
  { id: "650e566d-0880-49d8-99d3-6dcfb12555c1", raw_requirements: "7+ years of backend development experience. Expertise in Node.js or Python. Strong experience with microservices architecture, RESTful APIs, and message queues (e.g., RabbitMQ, Kafka). Proficient with PostgreSQL or similar relational databases. Experience with Docker, Kubernetes, and cloud platforms (AWS/GCP/Azure).", raw_job_desc: "Architect and implement microservices using Node.js/Express or Python/FastAPI. Design and optimize database schemas (PostgreSQL). Develop and maintain CI/CD pipelines. Ensure system security and data protection. Lead and mentor a team of backend developers." },
  { id: "a4137504-4272-4511-b9e6-ceb879d51cc3", raw_requirements: "5+ years of product management experience, preferably in AI/ML or SaaS. Strong analytical and problem-solving skills. Excellent communication and leadership abilities. Proven track record of launching successful products. Technical background or understanding of AI/ML concepts is a plus.", raw_job_desc: "Conduct market research and gather customer requirements. Define product vision, strategy, and roadmap. Write detailed product specifications and user stories. Collaborate with cross-functional teams throughout the product lifecycle. Analyze product performance and iterate based on data and feedback." },
  { id: "b678e67c-934d-475e-ba57-44873f271fbd", raw_requirements: "4+ years of DevOps experience. Strong experience with AWS or GCP. Proficiency in infrastructure-as-code tools (e.g., Terraform, CloudFormation). Experience with containerization (Docker, Kubernetes). Scripting skills in Python, Bash, or Go.", raw_job_desc: "Design, implement, and manage cloud infrastructure on AWS/GCP. Develop and automate CI/CD pipelines using Jenkins, GitLab CI, or similar tools. Implement and manage monitoring, logging, and alerting systems (e.g., Prometheus, Grafana, ELK stack). Ensure infrastructure security and compliance." },
  { id: "f89ec9b5-a505-4d6c-a86d-934581ae7eb9", raw_requirements: "3+ years of UX/UI design experience. Proficiency in design tools like Figma, Sketch, or Adobe XD. Strong portfolio showcasing user-centered design solutions. Excellent visual design skills and attention to detail. Experience with mobile and web application design.", raw_job_desc: "Conduct user research and usability testing. Create wireframes, mockups, and prototypes. Develop and maintain design systems and style guides. Collaborate with frontend developers to ensure design consistency and quality. Stay up-to-date with aui/UX trends and best practices." },
  { id: "990a2fd9-b060-4e3f-8c5a-e2b4c5832e45", raw_requirements: "4+ years of experience in data science or machine learning. Proficiency in Python and relevant libraries (e.g., scikit-learn, TensorFlow, PyTorch). Strong understanding of statistical modeling and machine learning algorithms. Experience with data visualization tools. PhD or Master\'s degree in a quantitative field is preferred.", raw_job_desc: "Clean, process, and analyze large datasets. Develop, train, and evaluate machine learning models. Deploy models to production and monitor their performance. Collaborate with engineers to integrate models into our products. Communicate findings and insights to stakeholders." },
  { id: "6e9515c7-60e2-4c2e-8bea-6ed43cf0b6f3", raw_requirements: "5+ years of marketing experience with a focus on growth. Proven track record of driving user acquisition. Strong analytical skills and data-driven mindset. Experience with marketing automation tools and analytics platforms. Excellent communication and project management skills.", raw_job_desc: "Develop and execute growth hacking strategies. Manage digital marketing channels (SEO, SEM, social media, email). Conduct A/B tests and analyze campaign performance. Identify and leverage new growth channels. Collaborate with product and sales teams." },
  { id: "a3f3b975-a2ae-4cd0-9dc2-f843bfd8a6b6", raw_requirements: "3+ years of experience in customer success or account management, preferably in SaaS. Excellent communication and interpersonal skills. Strong problem-solving abilities. Empathetic and customer-focused mindset. Experience with CRM software.", raw_job_desc: "Onboard new customers and provide training. Proactively engage with customers to understand their needs and challenges. Provide technical support and resolve issues. Identify opportunities for upselling and cross-selling. Gather customer feedback and advocate for their needs internally." },
  { id: "f42a6aee-927d-44c5-a85c-6266ca23502c", raw_requirements: "Bachelor\'s degree in Computer Science or related field (or equivalent practical experience). Solid understanding of web development fundamentals. Familiarity with at least one frontend framework (e.g., React, Angular, Vue) and one backend language (e.g., Node.js, Python, Java). Eagerness to learn and contribute.", raw_job_desc: "Assist in the development of new features and maintenance of existing codebase. Work with technologies like React, Node.js, Python, and PostgreSQL. Participate in code reviews and agile development processes. Learn from senior engineers and grow your skills." },
  { id: "898eba76-01ab-4f6f-b36c-0740f20b9412", raw_requirements: "2+ years of experience in technical writing or content creation for a tech audience. Excellent writing, editing, and proofreading skills. Ability to understand and explain complex technical topics clearly. Familiarity with software development concepts and terminology. Portfolio of writing samples.", raw_job_desc: "Research and write high-quality technical articles and documentation. Collaborate with engineers and product managers to understand complex technical concepts. Simplify technical information for various audiences. Manage and update our technical content library. Promote content through various channels." }
];

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const client = postgres(databaseUrl);
  const db = drizzle(client);

  const jobsToUpdate = jobsDataFromCSV.map(jobData => ({
    id: jobData.id,
    job_desc: parseTextToArray(jobData.raw_job_desc),
    requirements: parseTextToArray(jobData.raw_requirements),
  }));

  if (jobsToUpdate.length === 0) {
    console.log('No jobs found in the hardcoded data to update.');
    await client.end();
    return;
  }

  try {
    console.log(`Attempting to update ${jobsToUpdate.length} job vacancies from hardcoded data...`);

    for (const job of jobsToUpdate) {
      const updateData: { job_desc?: string[]; requirements?: string[] } = {};
      if (job.job_desc.length > 0) {
        updateData.job_desc = job.job_desc;
      }
      if (job.requirements.length > 0) {
        updateData.requirements = job.requirements;
      }

      if (Object.keys(updateData).length === 0) {
        console.log(`Skipping job ID: ${job.id} as there is no new job_desc or requirements data to update.`);
        continue;
      }

      console.log(`Updating job ID: ${job.id} with:`, updateData);
      const updated = await db.update(jobVacancies)
        .set(updateData)
        .where(eq(jobVacancies.id, job.id))
        .returning({
          id: jobVacancies.id,
          title: jobVacancies.title,
        });

      if (updated && updated.length > 0) {
        console.log(`Successfully updated job: ${updated[0].title} (ID: ${updated[0].id})`);
      } else {
        console.warn(`Failed to update job ID: ${job.id} or it was not found.`);
      }
    }

    console.log('Successfully finished updating job vacancies.');

  } catch (error) {
    console.error('Error updating job vacancies in the database:');
    if (error instanceof Error) {
      console.error(error.message);
      if ((error as any).code) { // For pg errors
        console.error(`PG Error Code: ${(error as any).code}`);
      }
      if ((error as any).detail) { // For pg errors with details
         console.error(`PG Error Detail: ${(error as any).detail}`);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  } finally {
    console.log('Closing database connection...');
    await client.end();
    console.log('Database connection closed.');
  }
};

main().catch((err) => {
  console.error("Unhandled error in main function:", err);
  process.exit(1);
}); 