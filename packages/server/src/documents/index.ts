/**
 * Document service - manages Carta documents
 */

import {
  generateDocumentId,
  generateSemanticId,
  CURRENT_FORMAT_VERSION,
  createSchemaRegistry,
  createCompiler,
} from '@carta/core';
import type {
  CartaDocument,
  CartaNode,
  CartaEdge,
  ConstructSchema,
  Deployable,
  DocumentMetadata,
  ConstructInstance,
} from '@carta/core';
import type { StorageAdapter } from '../storage/index.js';

export class DocumentService {
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  // ===== DOCUMENT OPERATIONS =====

  async createDocument(title: string): Promise<CartaDocument> {
    const now = new Date().toISOString();
    const doc: CartaDocument = {
      id: generateDocumentId(),
      title,
      version: 1,
      formatVersion: CURRENT_FORMAT_VERSION,
      createdAt: now,
      updatedAt: now,
      nodes: [],
      edges: [],
      deployables: [],
      customSchemas: [],
    };
    await this.storage.saveDocument(doc);
    return doc;
  }

  async getDocument(id: string): Promise<CartaDocument | null> {
    return this.storage.loadDocument(id);
  }

  async listDocuments(): Promise<DocumentMetadata[]> {
    return this.storage.listDocuments();
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.storage.deleteDocument(id);
  }

  async updateDocument(
    id: string,
    updates: Partial<Pick<CartaDocument, 'title' | 'nodes' | 'edges' | 'deployables' | 'customSchemas'>>
  ): Promise<CartaDocument | null> {
    const doc = await this.storage.loadDocument(id);
    if (!doc) return null;

    const updatedDoc = {
      ...doc,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.storage.saveDocument(updatedDoc);
    return updatedDoc;
  }

  // ===== CONSTRUCT OPERATIONS =====

  async listConstructs(documentId: string): Promise<CartaNode[]> {
    const doc = await this.storage.loadDocument(documentId);
    return doc?.nodes || [];
  }

  async getConstruct(documentId: string, semanticId: string): Promise<CartaNode | null> {
    const doc = await this.storage.loadDocument(documentId);
    if (!doc) return null;
    return doc.nodes.find((n) => n.data.semanticId === semanticId) || null;
  }

  async createConstruct(
    documentId: string,
    constructType: string,
    values: Record<string, unknown> = {},
    position = { x: 100, y: 100 }
  ): Promise<CartaNode | null> {
    const doc = await this.storage.loadDocument(documentId);
    if (!doc) return null;

    const semanticId = generateSemanticId(constructType);
    const nodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const node: CartaNode = {
      id: nodeId,
      type: 'construct',
      position,
      data: {
        constructType,
        semanticId,
        values,
        connections: [],
      },
    };

    doc.nodes.push(node);
    await this.storage.saveDocument(doc);
    return node;
  }

  async updateConstruct(
    documentId: string,
    semanticId: string,
    updates: Partial<ConstructInstance>
  ): Promise<CartaNode | null> {
    const doc = await this.storage.loadDocument(documentId);
    if (!doc) return null;

    const nodeIndex = doc.nodes.findIndex((n) => n.data.semanticId === semanticId);
    if (nodeIndex === -1) return null;

    const existingNode = doc.nodes[nodeIndex];
    if (!existingNode) return null;

    const updatedNode: CartaNode = {
      ...existingNode,
      data: {
        ...existingNode.data,
        ...updates,
      },
    };

    doc.nodes[nodeIndex] = updatedNode;
    await this.storage.saveDocument(doc);
    return updatedNode;
  }

  async deleteConstruct(documentId: string, semanticId: string): Promise<boolean> {
    const doc = await this.storage.loadDocument(documentId);
    if (!doc) return false;

    const initialLength = doc.nodes.length;
    const node = doc.nodes.find((n) => n.data.semanticId === semanticId);
    if (!node) return false;

    // Remove the node
    doc.nodes = doc.nodes.filter((n) => n.data.semanticId !== semanticId);

    // Remove edges connected to this node
    doc.edges = doc.edges.filter((e) => e.source !== node.id && e.target !== node.id);

    // Remove connections referencing this node from other nodes
    for (const n of doc.nodes) {
      if (n.data.connections) {
        n.data.connections = n.data.connections.filter(
          (c) => c.targetSemanticId !== semanticId
        );
      }
    }

    if (doc.nodes.length === initialLength) return false;

    await this.storage.saveDocument(doc);
    return true;
  }

  // ===== CONNECTION OPERATIONS =====

  async connectConstructs(
    documentId: string,
    sourceSemanticId: string,
    sourcePortId: string,
    targetSemanticId: string,
    targetPortId: string
  ): Promise<CartaEdge | null> {
    const doc = await this.storage.loadDocument(documentId);
    if (!doc) return null;

    const sourceNode = doc.nodes.find((n) => n.data.semanticId === sourceSemanticId);
    const targetNode = doc.nodes.find((n) => n.data.semanticId === targetSemanticId);
    if (!sourceNode || !targetNode) return null;

    // Create edge
    const edgeId = `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const edge: CartaEdge = {
      id: edgeId,
      source: sourceNode.id,
      target: targetNode.id,
      sourceHandle: sourcePortId,
      targetHandle: targetPortId,
    };

    doc.edges.push(edge);

    // Add connection to source node
    if (!sourceNode.data.connections) {
      sourceNode.data.connections = [];
    }
    sourceNode.data.connections.push({
      portId: sourcePortId,
      targetSemanticId,
      targetPortId,
    });

    await this.storage.saveDocument(doc);
    return edge;
  }

  async disconnectConstructs(
    documentId: string,
    sourceSemanticId: string,
    sourcePortId: string,
    targetSemanticId: string
  ): Promise<boolean> {
    const doc = await this.storage.loadDocument(documentId);
    if (!doc) return false;

    const sourceNode = doc.nodes.find((n) => n.data.semanticId === sourceSemanticId);
    if (!sourceNode) return false;

    // Remove connection from source node
    if (sourceNode.data.connections) {
      sourceNode.data.connections = sourceNode.data.connections.filter(
        (c) => !(c.portId === sourcePortId && c.targetSemanticId === targetSemanticId)
      );
    }

    // Remove corresponding edge
    const targetNode = doc.nodes.find((n) => n.data.semanticId === targetSemanticId);
    if (targetNode) {
      doc.edges = doc.edges.filter(
        (e) =>
          !(
            e.source === sourceNode.id &&
            e.target === targetNode.id &&
            e.sourceHandle === sourcePortId
          )
      );
    }

    await this.storage.saveDocument(doc);
    return true;
  }

  // ===== SCHEMA OPERATIONS =====

  async listSchemas(documentId: string): Promise<ConstructSchema[]> {
    const doc = await this.storage.loadDocument(documentId);
    if (!doc) return [];

    // Combine built-in and custom schemas
    const registry = createSchemaRegistry();
    for (const schema of doc.customSchemas) {
      registry.register(schema);
    }
    return registry.getAll();
  }

  async getSchema(documentId: string, type: string): Promise<ConstructSchema | null> {
    const schemas = await this.listSchemas(documentId);
    return schemas.find((s) => s.type === type) || null;
  }

  async createSchema(
    documentId: string,
    schema: ConstructSchema
  ): Promise<ConstructSchema | null> {
    const doc = await this.storage.loadDocument(documentId);
    if (!doc) return null;

    // Check if schema type already exists
    const existing = doc.customSchemas.find((s) => s.type === schema.type);
    if (existing) return null;

    doc.customSchemas.push(schema);
    await this.storage.saveDocument(doc);
    return schema;
  }

  // ===== DEPLOYABLE OPERATIONS =====

  async listDeployables(documentId: string): Promise<Deployable[]> {
    const doc = await this.storage.loadDocument(documentId);
    return doc?.deployables || [];
  }

  async createDeployable(
    documentId: string,
    name: string,
    description: string,
    color?: string
  ): Promise<Deployable | null> {
    const doc = await this.storage.loadDocument(documentId);
    if (!doc) return null;

    const deployable: Deployable = {
      id: `dep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      description,
      color: color || this.generateColor(),
    };

    doc.deployables.push(deployable);
    await this.storage.saveDocument(doc);
    return deployable;
  }

  // ===== COMPILATION =====

  async compile(documentId: string): Promise<string | null> {
    const doc = await this.storage.loadDocument(documentId);
    if (!doc) return null;

    const schemaRegistry = createSchemaRegistry();
    for (const schema of doc.customSchemas) {
      schemaRegistry.register(schema);
    }

    const deployableProvider = {
      getAll: () => doc.deployables,
      get: (id: string) => doc.deployables.find((d) => d.id === id),
    };

    const compiler = createCompiler({
      schemaRegistry,
      deployableProvider,
    });

    return compiler.compile(doc.nodes, doc.edges);
  }

  // ===== HELPERS =====

  private generateColor(): string {
    const colors = [
      '#3b82f6',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#06b6d4',
      '#84cc16',
      '#f97316',
      '#ec4899',
      '#6b7280',
    ];
    return colors[Math.floor(Math.random() * colors.length)] || '#3b82f6';
  }
}
