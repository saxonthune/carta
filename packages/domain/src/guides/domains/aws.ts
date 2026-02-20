export const AWS_GUIDE = `# Domain: AWS Cloud

## When to Use
User wants to model Lambda functions, API Gateway, DynamoDB, S3, SQS, or serverless architectures.

## Discovery Questions
Ask these to customize the vocabulary:
- "Event-driven or request-driven?" → affects trigger patterns (API Gateway vs EventBridge)
- "Which storage services?" → DynamoDB, S3, RDS, ElastiCache
- "Need monitoring/alerting?" → adds CloudWatch, SNS schemas
- "Async processing?" → adds SQS, Step Functions

## Schema Reference

Reference package: \`aws\`

### Compute

**Lambda** (\`aws-lambda\`) — #ff9900
- Fields: name (string, pill), runtime (enum: Node.js 20/Python 3.12/Java 21/Go/.NET 8/Ruby/Custom, summary), memory (number, summary), timeout (number, summary), description (string, summary)
- Ports: trigger-in ← Triggers, invoke-out → Invokes, child ← VPC

### API

**API Gateway** (\`aws-api-gateway\`) — #ff9900
- Fields: name (string, pill), apiType (enum: REST/HTTP/WebSocket, summary), stage (string, summary), description (string, summary)
- Ports: flow-in ← Requests, invoke-out → Backend

### Storage

**S3 Bucket** (\`aws-s3\`) — #569a31
- Fields: name (string, pill), accessLevel (enum: Private/Public Read/Public Read\/Write, summary), versioning (boolean, summary), purpose (string, summary)
- Ports: access-in ← Accessed By, trigger-out → Triggers

**DynamoDB** (\`aws-dynamodb\`) — #4053d6
- Fields: tableName (string, pill), partitionKey (string, summary), sortKey (string, summary), billingMode (enum: On-Demand/Provisioned, summary)
- Ports: access-in ← Accessed By, stream-out → Streams

**RDS Database** (\`aws-rds\`) — #4053d6
- Fields: name (string, pill), engine (enum: PostgreSQL/MySQL/MariaDB/SQL Server/Oracle/Aurora PostgreSQL/Aurora MySQL, summary), instanceClass (string, summary), multiAz (boolean, summary)
- Ports: access-in ← Clients, child ← VPC

### Messaging

**SQS Queue** (\`aws-sqs\`) — #ff4f8b
- Fields: name (string, pill), queueType (enum: Standard/FIFO, summary), visibilityTimeout (number, summary), dlq (boolean, summary)
- Ports: access-in ← Producers, trigger-out → Consumers

**SNS Topic** (\`aws-sns\`) — #d93f68
- Fields: name (string, pill), topicType (enum: Standard/FIFO, summary), purpose (string, summary)
- Ports: publish-in ← Publishers, subscribe-out → Subscribers

### Networking

**VPC** (\`aws-vpc\`) — #8c4fff
- Fields: name (string, pill), cidr (string, summary), purpose (string, summary)
- Ports: parent → Resources

### Step Functions

**State Machine** (\`aws-sfn-state-machine\`) — #ff4f8b
- Fields: name (string, pill), type (enum: Standard/Express, summary), description (string, summary)
- Ports: trigger-in ← Triggers, parent → States

**Task State** (\`aws-sfn-task\`) — #ff9900
- Fields: name (string, pill), resourceType (enum: Lambda/ECS/SNS/SQS/DynamoDB/Step Functions/HTTP, summary), timeout (number, summary), retry (boolean, summary)
- Ports: seq-in ← From, seq-out → Next, child ← State Machine, invoke-out → Resource

**Choice State** (\`aws-sfn-choice\`) — #f59e0b
- Fields: name (string, pill), description (string, summary)
- Ports: seq-in ← From, branch-out → Branches, default-out → Default, child ← State Machine

**Parallel State** (\`aws-sfn-parallel\`) — #22c55e
- Fields: name (string, pill), description (string, summary)
- Ports: seq-in ← From, seq-out → Next, child ← State Machine, parent → Branches

**Map State** (\`aws-sfn-map\`) — #8b5cf6
- Fields: name (string, pill), maxConcurrency (number, summary), itemsPath (string, summary)
- Ports: seq-in ← From, seq-out → Next, child ← State Machine, parent → Iterator

**Wait State** (\`aws-sfn-wait\`) — #64748b
- Fields: name (string, pill), waitType (enum: Seconds/Timestamp/SecondsPath/TimestampPath, summary), duration (string, summary)
- Ports: seq-in ← From, seq-out → Next, child ← State Machine

**Terminal State** (\`aws-sfn-terminal\`) — #dc2626
- Fields: name (string, pill), terminalType (enum: Succeed/Fail, summary), error (string, summary), cause (string, summary)
- Ports: seq-in ← From, child ← State Machine

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
