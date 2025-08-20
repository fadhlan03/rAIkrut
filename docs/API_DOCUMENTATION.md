# Job Generator API Documentation

## Overview
The Job Generator API provides AI-powered generation of job requirements and role benchmarks from top companies. This API can be used by external clients to integrate job generation capabilities into their applications.

## Base URL
```
https://yourdomain.com/api/v1
```

## Authentication
All API endpoints require authentication. Include your API key in the X-API-Key header:

```
x-api-key: your-api-key-here
```

## Rate Limiting
- **Limit**: 10 requests per minute per API key
- **Response Headers**: Rate limit info is returned in response headers
- **429 Status**: Returned when rate limit is exceeded

## Endpoints

### 1. Generate Job Requirements

**Endpoint**: `POST /api/v1/requirements`

**Description**: Generate comprehensive job requirements from 4-5 top companies for a specific role and industry.

**Request Body**:
```json
{
  "roleName": "Senior Software Engineer",
  "industry": "Technology"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "companies": [
      {
        "company": "Google",
        "logo": "GOOG",
        "requirements": [
          "Bachelor's degree in Computer Science or equivalent practical experience",
          "5+ years of experience in software development",
          "Proficiency in one or more programming languages (Java, Python, C++, Go)",
          "Experience with distributed systems and cloud technologies",
          "Strong problem-solving and analytical skills",
          "Experience with agile development methodologies"
        ]
      },
      {
        "company": "Microsoft",
        "logo": "MSFT",
        "requirements": [
          "Bachelor's degree in Computer Science, Engineering, or related field",
          "7+ years of professional software development experience",
          "Experience with .NET framework and Azure cloud services",
          "Knowledge of software engineering best practices",
          "Strong communication and collaboration skills",
          "Experience with CI/CD pipelines and DevOps practices"
        ]
      }
    ]
  },
  "meta": {
    "roleName": "Senior Software Engineer",
    "industry": "Technology",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": "v1"
  }
}
```

### 2. Generate Role Benchmarks

**Endpoint**: `POST /api/v1/benchmarks`

**Description**: Generate role responsibilities and descriptions from 4-5 top companies for a specific role and industry.

**Request Body**:
```json
{
  "roleName": "Product Manager",
  "industry": "Technology"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "companies": [
      {
        "company": "Apple",
        "logo": "AAPL",
        "responsibilities": [
          "Define product strategy and roadmap for consumer electronics",
          "Collaborate with engineering teams to deliver innovative features",
          "Conduct market research and competitive analysis",
          "Work with design teams to create intuitive user experiences",
          "Manage product lifecycle from conception to launch",
          "Analyze user feedback and iterate on product features",
          "Coordinate with marketing teams for product positioning"
        ]
      },
      {
        "company": "Amazon",
        "logo": "AMZN",
        "responsibilities": [
          "Own end-to-end product development process",
          "Drive data-driven decision making using analytics",
          "Collaborate with cross-functional teams globally",
          "Manage product backlogs and prioritize features",
          "Conduct customer interviews and usability testing",
          "Create detailed product specifications and requirements",
          "Monitor product performance and KPIs"
        ]
      }
    ]
  },
  "meta": {
    "roleName": "Product Manager",
    "industry": "Technology",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": "v1"
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request",
  "message": "Role name and industry are required"
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication required",
  "message": "Please provide a valid API key in x-api-key header"
}
```

### 429 Rate Limited
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later."
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Failed to generate requirements data"
}
```

### 503 Service Unavailable
```json
{
  "error": "Service unavailable",
  "message": "AI service is not configured properly"
}
```

## API Documentation Endpoints

### Get Requirements API Info
**Endpoint**: `GET /api/v1/requirements`

Returns detailed information about the requirements generation API.

### Get Benchmarks API Info
**Endpoint**: `GET /api/v1/benchmarks`

Returns detailed information about the benchmarks generation API.

## Example Usage

### cURL Examples

**Generate Requirements**:
```bash
curl -X POST https://yourdomain.com/api/v1/requirements \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "roleName": "Data Scientist",
    "industry": "Healthcare"
  }'
```

**Generate Benchmarks**:
```bash
curl -X POST https://yourdomain.com/api/v1/benchmarks \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "roleName": "Marketing Manager",
    "industry": "E-commerce"
  }'
```

### JavaScript Example

```javascript
// Generate job requirements
const response = await fetch('https://yourdomain.com/api/v1/requirements', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-api-key-here'
  },
  body: JSON.stringify({
    roleName: 'Frontend Developer',
    industry: 'Fintech'
  })
});

const data = await response.json();
console.log(data);
```

### Python Example

```python
import requests

# Generate role benchmarks
url = 'https://yourdomain.com/api/v1/benchmarks'
headers = {
    'Content-Type': 'application/json',
    'x-api-key': 'your-api-key-here'
}
data = {
    'roleName': 'DevOps Engineer',
    'industry': 'Cloud Services'
}

response = requests.post(url, headers=headers, json=data)
result = response.json()
print(result)
```

## Features

- **AI-Powered**: Uses Google Gemini 2.0 Flash with web search for current market data
- **Real-time Data**: Searches current job postings and industry standards
- **Structured Output**: Clean, consistent JSON format
- **Citation Cleaning**: Removes reference markers from generated content
- **Company Differentiation**: Shows unique company cultures and preferences
- **Current Standards**: Reflects 2024-2025 market conditions

## Rate Limits

10 requests per minute (checkRateLimit() function)
