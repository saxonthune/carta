import type { DocumentAdapter, OrganizerNodeData } from '@carta/domain';
import { generateSemanticId } from '@carta/domain';

// Simple organizer color palette
const ORGANIZER_COLORS = ['#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626'];

/**
 * SaaS architecture seed using exclusively built-in schemas.
 * Models a social-network-style app with Users, Friendships,
 * REST endpoints, database tables, and UI screens.
 *
 * ~15 nodes across 3 organizers.
 */
export function saas(adapter: DocumentAdapter): void {
  // --- Node IDs ---
  const getUsers = crypto.randomUUID();
  const postFriendships = crypto.randomUUID();
  const userModel = crypto.randomUUID();
  const friendshipModel = crypto.randomUUID();
  const postgresDb = crypto.randomUUID();
  const usersTable = crypto.randomUUID();
  const friendshipsTable = crypto.randomUUID();
  const profileScreen = crypto.randomUUID();
  const feedScreen = crypto.randomUUID();
  const loginStory = crypto.randomUUID();
  const friendStory = crypto.randomUUID();

  // --- Organizer IDs ---
  const apiOrganizer = crypto.randomUUID();
  const dbOrganizer = crypto.randomUUID();
  const uiOrganizer = crypto.randomUUID();

  // --- Layout constants ---
  const PADDING = 20;
  const HEADER_HEIGHT = 40;
  const ORG_WIDTH = 280;

  // --- Organizer positions ---
  const apiOrgPos = { x: 50, y: 50 };
  const dbOrgPos = { x: 400, y: 50 };
  const uiOrgPos = { x: 750, y: 50 };

  // --- Colors ---
  const apiColor = ORGANIZER_COLORS[0];
  const dbColor = ORGANIZER_COLORS[1];
  const uiColor = ORGANIZER_COLORS[2];

  adapter.setNodes([
    // ============ API Organizer ============
    {
      id: apiOrganizer,
      type: 'organizer',
      position: apiOrgPos,
      style: { width: ORG_WIDTH, height: 620 },
      data: {
        isOrganizer: true,
        name: 'API Layer',
        color: apiColor,
        collapsed: false,
        layout: 'freeform',
      } satisfies OrganizerNodeData,
    },
    {
      id: getUsers,
      type: 'construct',
      parentId: apiOrganizer,
      position: { x: PADDING, y: HEADER_HEIGHT + 10 },
      data: {
        constructType: 'rest-endpoint',
        semanticId: generateSemanticId('rest-endpoint'),
        values: { route: '/api/users', verb: 'GET', summary: 'List all users' },
      },
    },
    {
      id: postFriendships,
      type: 'construct',
      parentId: apiOrganizer,
      position: { x: PADDING, y: HEADER_HEIGHT + 170 },
      data: {
        constructType: 'rest-endpoint',
        semanticId: generateSemanticId('rest-endpoint'),
        values: { route: '/api/friendships', verb: 'POST', summary: 'Create a friendship' },
      },
    },
    {
      id: userModel,
      type: 'construct',
      parentId: apiOrganizer,
      position: { x: PADDING, y: HEADER_HEIGHT + 340 },
      data: {
        constructType: 'api-model',
        semanticId: generateSemanticId('api-model'),
        values: { modelName: 'User', modelType: 'response', data: 'id, email, name, createdAt' },
      },
    },
    {
      id: friendshipModel,
      type: 'construct',
      parentId: apiOrganizer,
      position: { x: PADDING, y: HEADER_HEIGHT + 480 },
      data: {
        constructType: 'api-model',
        semanticId: generateSemanticId('api-model'),
        values: { modelName: 'Friendship', modelType: 'request', data: 'userId, friendId' },
      },
    },

    // ============ Database Organizer ============
    {
      id: dbOrganizer,
      type: 'organizer',
      position: dbOrgPos,
      style: { width: ORG_WIDTH, height: 490 },
      data: {
        isOrganizer: true,
        name: 'Database Layer',
        color: dbColor,
        collapsed: false,
        layout: 'freeform',
      } satisfies OrganizerNodeData,
    },
    {
      id: postgresDb,
      type: 'construct',
      parentId: dbOrganizer,
      position: { x: PADDING, y: HEADER_HEIGHT + 10 },
      data: {
        constructType: 'database',
        semanticId: generateSemanticId('database'),
        values: { engine: 'PostgreSQL', note: 'Primary application database' },
      },
    },
    {
      id: usersTable,
      type: 'construct',
      parentId: dbOrganizer,
      position: { x: PADDING, y: HEADER_HEIGHT + 170 },
      data: {
        constructType: 'table',
        semanticId: generateSemanticId('table'),
        values: { tableName: 'users', columns: 'id UUID PK, email VARCHAR UNIQUE, name VARCHAR, created_at TIMESTAMP' },
      },
    },
    {
      id: friendshipsTable,
      type: 'construct',
      parentId: dbOrganizer,
      position: { x: PADDING, y: HEADER_HEIGHT + 340 },
      data: {
        constructType: 'table',
        semanticId: generateSemanticId('table'),
        values: { tableName: 'friendships', columns: 'id UUID PK, user_id UUID FK, friend_id UUID FK, created_at TIMESTAMP' },
      },
    },

    // ============ UI Organizer ============
    {
      id: uiOrganizer,
      type: 'organizer',
      position: uiOrgPos,
      style: { width: ORG_WIDTH, height: 620 },
      data: {
        isOrganizer: true,
        name: 'UI Layer',
        color: uiColor,
        collapsed: false,
        layout: 'freeform',
      } satisfies OrganizerNodeData,
    },
    {
      id: profileScreen,
      type: 'construct',
      parentId: uiOrganizer,
      position: { x: PADDING, y: HEADER_HEIGHT + 10 },
      data: {
        constructType: 'ui-screen',
        semanticId: generateSemanticId('ui-screen'),
        values: { screenName: 'Profile', description: 'User profile page showing info and friends list' },
      },
    },
    {
      id: feedScreen,
      type: 'construct',
      parentId: uiOrganizer,
      position: { x: PADDING, y: HEADER_HEIGHT + 170 },
      data: {
        constructType: 'ui-screen',
        semanticId: generateSemanticId('ui-screen'),
        values: { screenName: 'Feed', description: 'Activity feed from friends' },
      },
    },
    {
      id: loginStory,
      type: 'construct',
      parentId: uiOrganizer,
      position: { x: PADDING, y: HEADER_HEIGHT + 340 },
      data: {
        constructType: 'user-story',
        semanticId: generateSemanticId('user-story'),
        values: { title: 'User Login', description: 'As a user, I want to log in so that I can access my profile' },
      },
    },
    {
      id: friendStory,
      type: 'construct',
      parentId: uiOrganizer,
      position: { x: PADDING, y: HEADER_HEIGHT + 480 },
      data: {
        constructType: 'user-story',
        semanticId: generateSemanticId('user-story'),
        values: { title: 'Add Friend', description: 'As a user, I want to add friends so that I can see their activity' },
      },
    },
  ]);

  adapter.setEdges([
    // API endpoints -> Database (flow-out -> link-in)
    {
      id: `edge-${crypto.randomUUID()}`,
      source: getUsers,
      target: postgresDb,
      sourceHandle: 'flow-out',
      targetHandle: 'link-in',
    },
    {
      id: `edge-${crypto.randomUUID()}`,
      source: postFriendships,
      target: postgresDb,
      sourceHandle: 'flow-out',
      targetHandle: 'link-in',
    },
    // Endpoint -> Models (parent -> child)
    {
      id: `edge-${crypto.randomUUID()}`,
      source: getUsers,
      target: userModel,
      sourceHandle: 'parent',
      targetHandle: 'child',
    },
    {
      id: `edge-${crypto.randomUUID()}`,
      source: postFriendships,
      target: friendshipModel,
      sourceHandle: 'parent',
      targetHandle: 'child',
    },
    // Database -> Tables (child -> parent on database, parent -> child on table)
    {
      id: `edge-${crypto.randomUUID()}`,
      source: usersTable,
      target: postgresDb,
      sourceHandle: 'parent',
      targetHandle: 'child',
    },
    {
      id: `edge-${crypto.randomUUID()}`,
      source: friendshipsTable,
      target: postgresDb,
      sourceHandle: 'parent',
      targetHandle: 'child',
    },
    // Tables reference each other (friendships.user_id -> users)
    {
      id: `edge-${crypto.randomUUID()}`,
      source: friendshipsTable,
      target: usersTable,
      sourceHandle: 'link-out',
      targetHandle: 'link-in',
    },
    // User stories -> UI screens (flow-out -> flow-in)
    {
      id: `edge-${crypto.randomUUID()}`,
      source: loginStory,
      target: profileScreen,
      sourceHandle: 'flow-out',
      targetHandle: 'flow-in',
    },
    {
      id: `edge-${crypto.randomUUID()}`,
      source: friendStory,
      target: feedScreen,
      sourceHandle: 'flow-out',
      targetHandle: 'flow-in',
    },
  ]);
}
