export const AWS_GUIDE = `# Domain: AWS Cloud

## When to Use
User wants to model Lambda functions, API Gateway, DynamoDB, S3, SQS, or serverless architectures.

## Discovery Questions
Ask these to customize the vocabulary:
- "Event-driven or request-driven?" → affects trigger patterns (API Gateway vs EventBridge)
- "Which storage services?" → DynamoDB, S3, RDS, ElastiCache
- "Need monitoring/alerting?" → adds CloudWatch, SNS schemas
- "Async processing?" → adds SQS, Step Functions

## Recommended Schemas
Reference seed: \`aws\`

| Schema | Purpose | Pill Field | Key Display |
|--------|---------|-----------|-------------|
| Lambda Function | Serverless compute | name | runtime enum, orange theme |
| API Gateway | HTTP entry point | name | type enum (REST/HTTP/WebSocket) |
| DynamoDB Table | NoSQL database | name | partition/sort keys |
| S3 Bucket | Object storage | name | versioning/encryption flags |
| SQS Queue | Message queue | name | type enum (standard/FIFO) |
| EventBridge Rule | Event router | name | event pattern summary |
| Step Function | Workflow orchestrator | name | state machine definition |
| CloudWatch Alarm | Metric monitor | name | threshold display |

## Connection Patterns
- API Gateway →(invoke-out)→ Lambda Function
- Lambda Function →(flow-out)→ DynamoDB Table
- Lambda Function →(flow-out)→ S3 Bucket
- Lambda Function →(flow-out)→ SQS Queue →(invoke-out)→ Lambda Function
- EventBridge Rule →(invoke-out)→ Lambda Function
- Step Function →(parent)→ Lambda Function (orchestrated tasks)
- Lambda Function →(flow-out)→ CloudWatch Alarm (monitoring)

## Display Recommendations
- Group by service type: Compute, Storage, Messaging, Monitoring (use organizers)
- Orange theme for Lambda functions (AWS branding)
- Connection color coding: invoke=orange, flow=blue, policy=red
- S3 and DynamoDB: use \`instanceColors: true\` for per-instance color distinction
- Step Functions as organizers containing orchestrated Lambdas
`;
