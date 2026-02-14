export { SOFTWARE_ARCHITECTURE_GUIDE } from './software-architecture.js';
export { AWS_GUIDE } from './aws.js';
export { BPMN_GUIDE } from './bpmn.js';

export const DOMAIN_DIRECTORY_GUIDE = `# Carta Domain Guides

Read a specific domain guide for schema recommendations, discovery questions, and display tips.

| Domain | Resource URI | Keywords |
|--------|-------------|----------|
| Software Architecture | carta://guide/domains/software-architecture | REST API, services, databases, UI, microservices |
| AWS Cloud | carta://guide/domains/aws | Lambda, API Gateway, DynamoDB, S3, serverless, cloud |
| BPMN Process | carta://guide/domains/bpmn | Business process, workflow, events, gateways, lanes |

## How to Use
1. Read this directory to find the right domain
2. Fetch the specific guide URI for schema recommendations
3. Ask the user the discovery questions from the guide
4. Create schemas using \`carta_create_schema\`, referencing the guide's recommendations
5. Customize based on user answers — guides are advisory, not prescriptive
`;
