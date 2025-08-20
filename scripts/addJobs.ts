import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { jobVacancies } from '../src/db/schema.js'; // Adjust path if your schema is elsewhere
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; // For generating UUIDs for job IDs

// Load environment variables from .env.local first, then .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  console.log('Loading environment variables from .env.local');
  dotenv.config({ path: envLocalPath });
} else {
  console.log('Loading environment variables from .env (as .env.local was not found)');
  dotenv.config(); // Defaults to .env
}

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const client = postgres(databaseUrl);
  const db = drizzle(client);

  const createdById = '67014c16-7437-4247-baa5-8c978e68420c'; // Provided User ID

  const dummyJobs = [
    {
      title: 'Senior Frontend Engineer',
      description: 'Join our innovative team to build cutting-edge user interfaces for our flagship product. We are looking for a passionate developer with a strong eye for design and performance.',
      job_desc: 'Develop and maintain responsive web applications using React, Next.js, and TypeScript. Collaborate with product managers, designers, and backend engineers. Write clean, testable, and maintainable code. Mentor junior developers and contribute to code reviews.',
      requirements: '5+ years of experience in frontend development. Proficiency in React, Redux/Zustand, Next.js, TypeScript, HTML5, CSS3. Experience with RESTful APIs and GraphQL. Strong understanding of web performance optimization. Excellent problem-solving and communication skills.',
    },
    {
      title: 'Lead Backend Developer (Node.js/Python)',
      description: 'Lead the design and development of our scalable backend systems. You will be responsible for building robust APIs, managing databases, and ensuring the reliability of our platform.',
      job_desc: 'Architect and implement microservices using Node.js/Express or Python/FastAPI. Design and optimize database schemas (PostgreSQL). Develop and maintain CI/CD pipelines. Ensure system security and data protection. Lead and mentor a team of backend developers.',
      requirements: '7+ years of backend development experience. Expertise in Node.js or Python. Strong experience with microservices architecture, RESTful APIs, and message queues (e.g., RabbitMQ, Kafka). Proficient with PostgreSQL or similar relational databases. Experience with Docker, Kubernetes, and cloud platforms (AWS/GCP/Azure).',
    },
    {
      title: 'Product Manager - AI Solutions',
      description: 'Define and drive the product strategy for our AI-powered solutions. Work closely with engineering, design, and marketing to deliver impactful products that solve real-world problems.',
      job_desc: 'Conduct market research and gather customer requirements. Define product vision, strategy, and roadmap. Write detailed product specifications and user stories. Collaborate with cross-functional teams throughout the product lifecycle. Analyze product performance and iterate based on data and feedback.',
      requirements: '5+ years of product management experience, preferably in AI/ML or SaaS. Strong analytical and problem-solving skills. Excellent communication and leadership abilities. Proven track record of launching successful products. Technical background or understanding of AI/ML concepts is a plus.',
    },
    {
      title: 'DevOps Engineer',
      description: 'Build and maintain our cloud infrastructure, CI/CD pipelines, and monitoring systems. Ensure the reliability, scalability, and security of our platform.',
      job_desc: 'Design, implement, and manage cloud infrastructure on AWS/GCP. Develop and automate CI/CD pipelines using Jenkins, GitLab CI, or similar tools. Implement and manage monitoring, logging, and alerting systems (e.g., Prometheus, Grafana, ELK stack). Ensure infrastructure security and compliance.',
      requirements: '4+ years of DevOps experience. Strong experience with AWS or GCP. Proficiency in infrastructure-as-code tools (e.g., Terraform, CloudFormation). Experience with containerization (Docker, Kubernetes). Scripting skills in Python, Bash, or Go.',
    },
    {
      title: 'UX/UI Designer',
      description: 'Create intuitive and visually appealing user experiences for our web and mobile applications. Collaborate with product managers and engineers to translate ideas into user-centered designs.',
      job_desc: 'Conduct user research and usability testing. Create wireframes, mockups, and prototypes. Develop and maintain design systems and style guides. Collaborate with frontend developers to ensure design consistency and quality. Stay up-to-date with aui/UX trends and best practices.',
      requirements: '3+ years of UX/UI design experience. Proficiency in design tools like Figma, Sketch, or Adobe XD. Strong portfolio showcasing user-centered design solutions. Excellent visual design skills and attention to detail. Experience with mobile and web application design.',
    },
    {
      title: 'Data Scientist',
      description: 'Develop and deploy machine learning models to solve complex business problems. Analyze large datasets, extract insights, and contribute to data-driven decision-making.',
      job_desc: 'Clean, process, and analyze large datasets. Develop, train, and evaluate machine learning models. Deploy models to production and monitor their performance. Collaborate with engineers to integrate models into our products. Communicate findings and insights to stakeholders.',
      requirements: '4+ years of experience in data science or machine learning. Proficiency in Python and relevant libraries (e.g., scikit-learn, TensorFlow, PyTorch). Strong understanding of statistical modeling and machine learning algorithms. Experience with data visualization tools. PhD or Master\'s degree in a quantitative field is preferred.',
    },
    {
      title: 'Marketing Manager - Growth Hacking',
      description: 'Drive user acquisition and growth through innovative marketing strategies and experiments. Analyze data, identify growth opportunities, and optimize marketing campaigns.',
      job_desc: 'Develop and execute growth hacking strategies. Manage digital marketing channels (SEO, SEM, social media, email). Conduct A/B tests and analyze campaign performance. Identify and leverage new growth channels. Collaborate with product and sales teams.',
      requirements: '5+ years of marketing experience with a focus on growth. Proven track record of driving user acquisition. Strong analytical skills and data-driven mindset. Experience with marketing automation tools and analytics platforms. Excellent communication and project management skills.',
    },
    {
      title: 'Customer Success Manager',
      description: 'Ensure our customers achieve their desired outcomes while using our products. Build strong relationships, provide support, and drive customer retention and expansion.',
      job_desc: 'Onboard new customers and provide training. Proactively engage with customers to understand their needs and challenges. Provide technical support and resolve issues. Identify opportunities for upselling and cross-selling. Gather customer feedback and advocate for their needs internally.',
      requirements: '3+ years of experience in customer success or account management, preferably in SaaS. Excellent communication and interpersonal skills. Strong problem-solving abilities. Empathetic and customer-focused mindset. Experience with CRM software.',
    },
    {
      title: 'Junior Software Engineer (Full-Stack)',
      description: 'An exciting opportunity for a recent graduate or early-career engineer to contribute to both frontend and backend development in a fast-paced startup environment.',
      job_desc: 'Assist in the development of new features and maintenance of existing codebase. Work with technologies like React, Node.js, Python, and PostgreSQL. Participate in code reviews and agile development processes. Learn from senior engineers and grow your skills.',
      requirements: 'Bachelor\'s degree in Computer Science or related field (or equivalent practical experience). Solid understanding of web development fundamentals. Familiarity with at least one frontend framework (e.g., React, Angular, Vue) and one backend language (e.g., Node.js, Python, Java). Eagerness to learn and contribute.',
    },
    {
      title: 'Technical Content Writer',
      description: 'Create compelling and informative technical content, including blog posts, documentation, tutorials, and case studies, to engage our developer community and showcase our technology.',
      job_desc: 'Research and write high-quality technical articles and documentation. Collaborate with engineers and product managers to understand complex technical concepts. Simplify technical information for various audiences. Manage and update our technical content library. Promote content through various channels.',
      requirements: '2+ years of experience in technical writing or content creation for a tech audience. Excellent writing, editing, and proofreading skills. Ability to understand and explain complex technical topics clearly. Familiarity with software development concepts and terminology. Portfolio of writing samples.',
    }
  ];

  try {
    console.log(`Attempting to insert ${dummyJobs.length} job vacancies...`);

    for (const job of dummyJobs) {
      const newJob = {
        // id will be generated by defaultRandom() in the schema
        createdBy: createdById,
        title: job.title,
        description: job.description,
        job_desc: job.job_desc,
        requirements: job.requirements,
        // createdAt will be set by defaultNow() in the schema
      };

      const inserted = await db.insert(jobVacancies).values(newJob).returning({
        id: jobVacancies.id,
        title: jobVacancies.title,
      });

      if (inserted && inserted.length > 0) {
        console.log(`Successfully added job: ${inserted[0].title} (ID: ${inserted[0].id})`);
      } else {
        console.warn(`Failed to add job: ${job.title}. No record returned.`);
      }
    }

    console.log('Successfully finished adding dummy job vacancies.');

  } catch (error) {
    console.error('Error adding job vacancies to the database:');
    if (error instanceof Error) {
      console.error(error.message);
      if ((error as any).code) { // For pg errors
        console.error(`PG Error Code: ${(error as any).code}`);
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