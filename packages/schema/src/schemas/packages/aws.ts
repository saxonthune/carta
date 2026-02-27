import type { SchemaPackageDefinition } from '../../types/index.js';

export const awsPackage: SchemaPackageDefinition = {
  id: 'std-pkg-aws',
  name: 'AWS',
  description: 'Amazon Web Services cloud architecture constructs',
  color: '#ff9900',
  schemas: [
    // Lambda Function
    {
      type: 'aws-lambda',
      displayName: 'Lambda',
      color: '#ff9900',
      semanticDescription: 'AWS Lambda serverless function',

      ports: [
        { id: 'trigger-in', portType: 'flow-in', label: 'Triggers', semanticDescription: 'Event sources that invoke this function' },
        { id: 'invoke-out', portType: 'flow-out', label: 'Invokes', semanticDescription: 'Services this function calls' },
        { id: 'child', portType: 'child', label: 'VPC', semanticDescription: 'VPC this function runs in' },
      ],
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Function name', placeholder: 'e.g., processOrder', displayTier: 'pill', displayOrder: 0 },
        { name: 'runtime', label: 'Runtime', type: 'enum', semanticDescription: 'Execution runtime', options: [{ value: 'Node.js 20' }, { value: 'Python 3.12' }, { value: 'Java 21' }, { value: 'Go' }, { value: '.NET 8' }, { value: 'Ruby' }, { value: 'Custom' }], default: 'Node.js 20', displayTier: 'summary', displayOrder: 1 },
        { name: 'memory', label: 'Memory (MB)', type: 'number', semanticDescription: 'Allocated memory in MB', default: 128, displayTier: 'summary', displayOrder: 2 },
        { name: 'timeout', label: 'Timeout (s)', type: 'number', semanticDescription: 'Execution timeout in seconds', default: 30, displayTier: 'summary', displayOrder: 3 },
        { name: 'description', label: 'Description', type: 'string', semanticDescription: 'Function purpose', placeholder: 'What does this function do?', displayTier: 'summary', displayOrder: 4 },
      ],
      compilation: { format: 'json', sectionHeader: '# AWS Lambda Functions' },
    },

    // API Gateway
    {
      type: 'aws-api-gateway',
      displayName: 'API Gateway',
      color: '#ff9900',
      semanticDescription: 'AWS API Gateway REST or HTTP API',

      ports: [
        { id: 'flow-in', portType: 'flow-in', label: 'Requests', semanticDescription: 'Incoming API requests' },
        { id: 'invoke-out', portType: 'flow-out', label: 'Backend', semanticDescription: 'Backend integrations (Lambda, HTTP)' },
      ],
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'API name', placeholder: 'e.g., OrderAPI', displayTier: 'pill', displayOrder: 0 },
        { name: 'apiType', label: 'Type', type: 'enum', semanticDescription: 'API type', options: [{ value: 'REST' }, { value: 'HTTP' }, { value: 'WebSocket' }], default: 'REST', displayTier: 'summary', displayOrder: 1 },
        { name: 'stage', label: 'Stage', type: 'string', semanticDescription: 'Deployment stage', placeholder: 'e.g., prod, dev', default: 'prod', displayTier: 'summary', displayOrder: 2 },
        { name: 'description', label: 'Description', type: 'string', semanticDescription: 'API purpose', placeholder: 'What does this API do?', displayTier: 'summary', displayOrder: 3 },
      ],
      compilation: { format: 'json' },
    },

    // S3 Bucket
    {
      type: 'aws-s3',
      displayName: 'S3 Bucket',
      color: '#569a31',
      semanticDescription: 'AWS S3 object storage bucket',

      ports: [
        { id: 'access-in', portType: 'flow-in', label: 'Accessed By', semanticDescription: 'Services that read/write this bucket' },
        { id: 'trigger-out', portType: 'flow-out', label: 'Triggers', semanticDescription: 'Event notifications to Lambda/SQS/SNS' },
      ],
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Bucket name', placeholder: 'e.g., my-app-uploads', displayTier: 'pill', displayOrder: 0 },
        { name: 'accessLevel', label: 'Access', type: 'enum', semanticDescription: 'Bucket access level', options: [{ value: 'Private' }, { value: 'Public Read' }, { value: 'Public Read/Write' }], default: 'Private', displayTier: 'summary', displayOrder: 1 },
        { name: 'versioning', label: 'Versioning', type: 'boolean', semanticDescription: 'Enable versioning', default: false, displayTier: 'summary', displayOrder: 2 },
        { name: 'purpose', label: 'Purpose', type: 'string', semanticDescription: 'What this bucket stores', placeholder: 'e.g., User uploads, Static assets', displayTier: 'summary', displayOrder: 3 },
      ],
      compilation: { format: 'json' },
    },

    // DynamoDB Table
    {
      type: 'aws-dynamodb',
      displayName: 'DynamoDB',
      color: '#4053d6',
      semanticDescription: 'AWS DynamoDB NoSQL table',

      ports: [
        { id: 'access-in', portType: 'flow-in', label: 'Accessed By', semanticDescription: 'Services that read/write this table' },
        { id: 'stream-out', portType: 'flow-out', label: 'Streams', semanticDescription: 'DynamoDB Streams triggers' },
      ],
      fields: [
        { name: 'tableName', label: 'Table Name', type: 'string', semanticDescription: 'Table name', placeholder: 'e.g., Orders', displayTier: 'pill', displayOrder: 0 },
        { name: 'partitionKey', label: 'Partition Key', type: 'string', semanticDescription: 'Primary partition key', placeholder: 'e.g., userId', displayTier: 'summary', displayOrder: 1 },
        { name: 'sortKey', label: 'Sort Key', type: 'string', semanticDescription: 'Optional sort key', placeholder: 'e.g., timestamp', displayTier: 'summary', displayOrder: 2 },
        { name: 'billingMode', label: 'Billing', type: 'enum', semanticDescription: 'Capacity billing mode', options: [{ value: 'On-Demand' }, { value: 'Provisioned' }], default: 'On-Demand', displayTier: 'summary', displayOrder: 3 },
      ],
      compilation: { format: 'json' },
    },

    // SQS Queue
    {
      type: 'aws-sqs',
      displayName: 'SQS Queue',
      color: '#ff4f8b',
      semanticDescription: 'AWS SQS message queue',

      ports: [
        { id: 'access-in', portType: 'flow-in', label: 'Producers', semanticDescription: 'Services that send messages to this queue' },
        { id: 'trigger-out', portType: 'flow-out', label: 'Consumers', semanticDescription: 'Services that consume from this queue' },
      ],
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Queue name', placeholder: 'e.g., order-processing', displayTier: 'pill', displayOrder: 0 },
        { name: 'queueType', label: 'Type', type: 'enum', semanticDescription: 'Queue type', options: [{ value: 'Standard' }, { value: 'FIFO' }], default: 'Standard', displayTier: 'summary', displayOrder: 1 },
        { name: 'visibilityTimeout', label: 'Visibility (s)', type: 'number', semanticDescription: 'Visibility timeout in seconds', default: 30, displayTier: 'summary', displayOrder: 2 },
        { name: 'dlq', label: 'DLQ', type: 'boolean', semanticDescription: 'Has dead-letter queue', default: true, displayTier: 'summary', displayOrder: 3 },
      ],
      compilation: { format: 'json' },
    },

    // SNS Topic
    {
      type: 'aws-sns',
      displayName: 'SNS Topic',
      color: '#d93f68',
      semanticDescription: 'AWS SNS pub/sub topic',

      ports: [
        { id: 'publish-in', portType: 'flow-in', label: 'Publishers', semanticDescription: 'Services that publish to this topic' },
        { id: 'subscribe-out', portType: 'flow-out', label: 'Subscribers', semanticDescription: 'Services subscribed to this topic' },
      ],
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Topic name', placeholder: 'e.g., order-events', displayTier: 'pill', displayOrder: 0 },
        { name: 'topicType', label: 'Type', type: 'enum', semanticDescription: 'Topic type', options: [{ value: 'Standard' }, { value: 'FIFO' }], default: 'Standard', displayTier: 'summary', displayOrder: 1 },
        { name: 'purpose', label: 'Purpose', type: 'string', semanticDescription: 'What events this topic handles', placeholder: 'e.g., Order lifecycle events', displayTier: 'summary', displayOrder: 2 },
      ],
      compilation: { format: 'json' },
    },

    // RDS Instance
    {
      type: 'aws-rds',
      displayName: 'RDS Database',
      color: '#4053d6',
      semanticDescription: 'AWS RDS relational database instance',

      ports: [
        { id: 'access-in', portType: 'flow-in', label: 'Clients', semanticDescription: 'Services that connect to this database' },
        { id: 'child', portType: 'child', label: 'VPC', semanticDescription: 'VPC this database runs in' },
      ],
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Instance identifier', placeholder: 'e.g., orders-db', displayTier: 'pill', displayOrder: 0 },
        { name: 'engine', label: 'Engine', type: 'enum', semanticDescription: 'Database engine', options: [{ value: 'PostgreSQL' }, { value: 'MySQL' }, { value: 'MariaDB' }, { value: 'SQL Server' }, { value: 'Oracle' }, { value: 'Aurora PostgreSQL' }, { value: 'Aurora MySQL' }], default: 'PostgreSQL', displayTier: 'summary', displayOrder: 1 },
        { name: 'instanceClass', label: 'Instance', type: 'string', semanticDescription: 'Instance class', placeholder: 'e.g., db.t3.micro', default: 'db.t3.micro', displayTier: 'summary', displayOrder: 2 },
        { name: 'multiAz', label: 'Multi-AZ', type: 'boolean', semanticDescription: 'Multi-AZ deployment', default: false, displayTier: 'summary', displayOrder: 3 },
      ],
      compilation: { format: 'json' },
    },

    // VPC
    {
      type: 'aws-vpc',
      displayName: 'VPC',
      color: '#8c4fff',
      semanticDescription: 'AWS Virtual Private Cloud network',

      ports: [
        { id: 'parent', portType: 'parent', label: 'Resources', semanticDescription: 'Resources running in this VPC' },
      ],
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'VPC name', placeholder: 'e.g., production-vpc', displayTier: 'pill', displayOrder: 0 },
        { name: 'cidr', label: 'CIDR', type: 'string', semanticDescription: 'IP address range', placeholder: 'e.g., 10.0.0.0/16', default: '10.0.0.0/16', displayTier: 'summary', displayOrder: 1 },
        { name: 'purpose', label: 'Purpose', type: 'string', semanticDescription: 'VPC purpose', placeholder: 'e.g., Production workloads', displayTier: 'summary', displayOrder: 2 },
      ],
      compilation: { format: 'json', sectionHeader: '# AWS Infrastructure' },
    },

    // Step Functions State Machine
    {
      type: 'aws-sfn-state-machine',
      displayName: 'State Machine',
      color: '#ff4f8b',
      semanticDescription: 'AWS Step Functions state machine workflow',

      ports: [
        { id: 'trigger-in', portType: 'flow-in', label: 'Triggers', semanticDescription: 'Services that start this workflow' },
        { id: 'parent', portType: 'parent', label: 'States', semanticDescription: 'States within this state machine' },
      ],
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'State machine name', placeholder: 'e.g., OrderProcessing', displayTier: 'pill', displayOrder: 0 },
        { name: 'type', label: 'Type', type: 'enum', semanticDescription: 'Execution type', options: [{ value: 'Standard' }, { value: 'Express' }], default: 'Standard', displayTier: 'summary', displayOrder: 1 },
        { name: 'description', label: 'Description', type: 'string', semanticDescription: 'Workflow purpose', placeholder: 'What does this workflow do?', displayTier: 'summary', displayOrder: 2 },
      ],
      compilation: { format: 'json', sectionHeader: '# Step Functions Workflows' },
    },

    // Step Functions Task State
    {
      type: 'aws-sfn-task',
      displayName: 'Task State',
      color: '#ff9900',
      semanticDescription: 'Step Functions task state that performs work',

      ports: [
        { id: 'seq-in', portType: 'flow-in', label: 'From', semanticDescription: 'Previous state in sequence' },
        { id: 'seq-out', portType: 'flow-out', label: 'Next', semanticDescription: 'Next state in sequence' },
        { id: 'child', portType: 'child', label: 'State Machine', semanticDescription: 'State machine containing this state' },
        { id: 'invoke-out', portType: 'flow-out', label: 'Resource', semanticDescription: 'Resource this task invokes' },
      ],
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'State name', placeholder: 'e.g., ProcessPayment', displayTier: 'pill', displayOrder: 0 },
        { name: 'resourceType', label: 'Resource', type: 'enum', semanticDescription: 'Task resource type', options: [{ value: 'Lambda' }, { value: 'ECS' }, { value: 'SNS' }, { value: 'SQS' }, { value: 'DynamoDB' }, { value: 'Step Functions' }, { value: 'HTTP' }], default: 'Lambda', displayTier: 'summary', displayOrder: 1 },
        { name: 'timeout', label: 'Timeout (s)', type: 'number', semanticDescription: 'Task timeout', default: 300, displayTier: 'summary', displayOrder: 2 },
        { name: 'retry', label: 'Retry', type: 'boolean', semanticDescription: 'Enable automatic retries', default: true, displayTier: 'summary', displayOrder: 3 },
      ],
      compilation: { format: 'json' },
    },

    // Step Functions Choice State
    {
      type: 'aws-sfn-choice',
      displayName: 'Choice State',
      color: '#f59e0b',
      semanticDescription: 'Step Functions choice state for branching logic',

      ports: [
        { id: 'seq-in', portType: 'flow-in', label: 'From', semanticDescription: 'Previous state in sequence' },
        { id: 'branch-out', portType: 'flow-out', label: 'Branches', semanticDescription: 'Conditional branches' },
        { id: 'default-out', portType: 'flow-out', label: 'Default', semanticDescription: 'Default branch if no conditions match' },
        { id: 'child', portType: 'child', label: 'State Machine', semanticDescription: 'State machine containing this state' },
      ],
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'State name', placeholder: 'e.g., CheckOrderStatus', displayTier: 'pill', displayOrder: 0 },
        { name: 'description', label: 'Description', type: 'string', semanticDescription: 'Decision logic description', placeholder: 'What conditions are evaluated?', displayTier: 'summary', displayOrder: 1 },
      ],
      compilation: { format: 'json' },
    },

    // Step Functions Parallel State
    {
      type: 'aws-sfn-parallel',
      displayName: 'Parallel State',
      color: '#22c55e',
      semanticDescription: 'Step Functions parallel state for concurrent execution',

      ports: [
        { id: 'seq-in', portType: 'flow-in', label: 'From', semanticDescription: 'Previous state in sequence' },
        { id: 'seq-out', portType: 'flow-out', label: 'Next', semanticDescription: 'Next state after all branches complete' },
        { id: 'child', portType: 'child', label: 'State Machine', semanticDescription: 'State machine containing this state' },
        { id: 'parent', portType: 'parent', label: 'Branches', semanticDescription: 'Parallel branch states' },
      ],
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'State name', placeholder: 'e.g., ParallelProcessing', displayTier: 'pill', displayOrder: 0 },
        { name: 'description', label: 'Description', type: 'string', semanticDescription: 'What runs in parallel', placeholder: 'What branches run concurrently?', displayTier: 'summary', displayOrder: 1 },
      ],
      compilation: { format: 'json' },
    },

    // Step Functions Map State
    {
      type: 'aws-sfn-map',
      displayName: 'Map State',
      color: '#8b5cf6',
      semanticDescription: 'Step Functions map state for iterating over arrays',

      ports: [
        { id: 'seq-in', portType: 'flow-in', label: 'From', semanticDescription: 'Previous state in sequence' },
        { id: 'seq-out', portType: 'flow-out', label: 'Next', semanticDescription: 'Next state after iteration completes' },
        { id: 'child', portType: 'child', label: 'State Machine', semanticDescription: 'State machine containing this state' },
        { id: 'parent', portType: 'parent', label: 'Iterator', semanticDescription: 'States executed for each item' },
      ],
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'State name', placeholder: 'e.g., ProcessItems', displayTier: 'pill', displayOrder: 0 },
        { name: 'maxConcurrency', label: 'Max Concurrency', type: 'number', semanticDescription: 'Maximum parallel iterations', default: 0, displayTier: 'summary', displayOrder: 1 },
        { name: 'itemsPath', label: 'Items Path', type: 'string', semanticDescription: 'JSONPath to array to iterate', placeholder: '$.items', displayTier: 'summary', displayOrder: 2 },
      ],
      compilation: { format: 'json' },
    },

    // Step Functions Wait State
    {
      type: 'aws-sfn-wait',
      displayName: 'Wait State',
      color: '#64748b',
      semanticDescription: 'Step Functions wait state for delays',

      ports: [
        { id: 'seq-in', portType: 'flow-in', label: 'From', semanticDescription: 'Previous state in sequence' },
        { id: 'seq-out', portType: 'flow-out', label: 'Next', semanticDescription: 'Next state after wait' },
        { id: 'child', portType: 'child', label: 'State Machine', semanticDescription: 'State machine containing this state' },
      ],
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'State name', placeholder: 'e.g., WaitForApproval', displayTier: 'pill', displayOrder: 0 },
        { name: 'waitType', label: 'Wait Type', type: 'enum', semanticDescription: 'How to determine wait duration', options: [{ value: 'Seconds' }, { value: 'Timestamp' }, { value: 'SecondsPath' }, { value: 'TimestampPath' }], default: 'Seconds', displayTier: 'summary', displayOrder: 1 },
        { name: 'duration', label: 'Duration', type: 'string', semanticDescription: 'Wait duration or path', placeholder: 'e.g., 300 or $.waitTime', displayTier: 'summary', displayOrder: 2 },
      ],
      compilation: { format: 'json' },
    },

    // Step Functions Terminal State (Succeed/Fail)
    {
      type: 'aws-sfn-terminal',
      displayName: 'Terminal State',
      color: '#dc2626',
      semanticDescription: 'Step Functions succeed or fail terminal state',

      ports: [
        { id: 'seq-in', portType: 'flow-in', label: 'From', semanticDescription: 'Previous state in sequence' },
        { id: 'child', portType: 'child', label: 'State Machine', semanticDescription: 'State machine containing this state' },
      ],
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'State name', placeholder: 'e.g., OrderComplete', displayTier: 'pill', displayOrder: 0 },
        { name: 'terminalType', label: 'Type', type: 'enum', semanticDescription: 'Terminal state type', options: [{ value: 'Succeed' }, { value: 'Fail' }], default: 'Succeed', displayTier: 'summary', displayOrder: 1 },
        { name: 'error', label: 'Error', type: 'string', semanticDescription: 'Error code (Fail only)', placeholder: 'e.g., OrderFailed', displayTier: 'summary', displayOrder: 2 },
        { name: 'cause', label: 'Cause', type: 'string', semanticDescription: 'Error cause (Fail only)', placeholder: 'Describe the failure reason', displayTier: 'summary', displayOrder: 3 },
      ],
      compilation: { format: 'json' },
    },
  ],
  portSchemas: [],
  schemaGroups: [],
  schemaRelationships: [],
};
