import { getLedgerArtifacts, getTask, listTaskIdsByContextId } from '@inkeep/agents-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toolSessionManager } from '../../agents/ToolSessionManager';
import {
  type ArtifactCreateRequest,
  ArtifactService,
  type ArtifactServiceContext,
} from '../ArtifactService';
import { graphSessionManager } from '../GraphSession';

// Mock dependencies
vi.mock('../../agents/ToolSessionManager');
vi.mock('../GraphSession');
vi.mock('@inkeep/agents-core');
vi.mock('../../data/db/dbClient', () => ({
  default: 'mock-db-client',
}));

describe('ArtifactService', () => {
  let artifactService: ArtifactService;
  let mockContext: ArtifactServiceContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      tenantId: 'test-tenant',
      sessionId: 'test-session',
      taskId: 'test-task',
      projectId: 'test-project',
      contextId: 'test-context',
      streamRequestId: 'test-stream-request',
      agentId: 'test-agent',
      artifactComponents: [
        {
          id: 'test-component-id',
          name: 'TestComponent',
          description: 'Test component description',
          summaryProps: {
            properties: {
              title: { type: 'string', description: 'Title' },
              summary: { type: 'string', description: 'Summary' },
            },
          },
          fullProps: {
            properties: {
              content: { type: 'string', description: 'Content' },
              details: { type: 'object', description: 'Details' },
            },
          },
        },
      ],
    };

    artifactService = new ArtifactService(mockContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getContextArtifacts', () => {
    it('should fetch and organize artifacts by context', async () => {
      const mockTaskIds = ['task1', 'task2'];
      const mockTask = {
        tenantId: 'test-tenant',
        projectId: 'test-project',
        graphId: 'test-graph',
        id: 'task1',
        contextId: 'test-context',
        status: 'active',
        metadata: null,
        agentId: 'test-agent',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      const mockArtifacts = [
        {
          artifactId: 'artifact1',
          taskId: 'task1',
          parts: [{ kind: 'data' as const, data: {} }],
          metadata: { toolCallId: 'tool1' },
        },
        {
          artifactId: 'artifact2',
          taskId: 'task2',
          parts: [{ kind: 'data' as const, data: {} }],
          metadata: { toolCallId: 'tool2' },
        },
      ];

      vi.mocked(listTaskIdsByContextId).mockReturnValue(() => Promise.resolve(mockTaskIds));
      vi.mocked(getTask).mockReturnValue(() => Promise.resolve(mockTask));
      vi.mocked(getLedgerArtifacts).mockReturnValue(() => Promise.resolve(mockArtifacts));

      const result = await artifactService.getContextArtifacts('test-context');

      expect(result.size).toBe(4); // 2 artifacts × 2 keys each (toolCallId + taskId)
      expect(result.has('artifact1:tool1')).toBe(true);
      expect(result.has('artifact1:task1')).toBe(true);
      expect(result.has('artifact2:tool2')).toBe(true);
      expect(result.has('artifact2:task2')).toBe(true);
    });

    it('should handle missing tasks gracefully', async () => {
      const mockTaskIds = ['task1', 'task2'];

      vi.mocked(listTaskIdsByContextId).mockReturnValue(() => Promise.resolve(mockTaskIds));
      vi.mocked(getTask)
        .mockReturnValueOnce(() =>
          Promise.resolve({
            tenantId: 'test-tenant',
            projectId: 'test-project',
            graphId: 'test-graph',
            id: 'task1',
            contextId: 'test-context',
            status: 'active',
            metadata: null,
            agentId: 'test-agent',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          })
        )
        .mockReturnValueOnce(() => Promise.resolve(null)); // Second task not found
      vi.mocked(getLedgerArtifacts).mockReturnValue(() =>
        Promise.resolve([
          {
            artifactId: 'artifact1',
            taskId: 'task1',
            parts: [{ kind: 'data', data: {} }],
            metadata: { toolCallId: 'tool1' },
          },
        ])
      );

      const result = await artifactService.getContextArtifacts('test-context');

      expect(result.size).toBe(2); // Only one artifact's keys
      expect(result.has('artifact1:tool1')).toBe(true);
      expect(result.has('artifact1:task1')).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(listTaskIdsByContextId).mockReturnValue(() =>
        Promise.reject(new Error('Database error'))
      );

      const result = await artifactService.getContextArtifacts('test-context');

      expect(result.size).toBe(0);
    });
  });

  describe('createArtifact', () => {
    const mockRequest: ArtifactCreateRequest = {
      artifactId: 'test-artifact',
      toolCallId: 'test-tool-call',
      type: 'TestComponent',
      baseSelector: 'result.data[0]',
      summaryProps: { title: 'title', summary: 'summary' },
      fullProps: { content: 'content', details: 'details' },
    };

    it('should create artifact successfully with valid tool result', async () => {
      const mockToolResult = {
        toolCallId: 'test-tool-call',
        toolName: 'test-tool',
        timestamp: Date.now(),
        result: {
          data: [
            {
              title: 'Test Title',
              summary: 'Test Summary',
              content: 'Test Content',
              details: { extra: 'info' },
            },
          ],
        },
      };

      vi.mocked(toolSessionManager.getToolResult).mockReturnValue(mockToolResult);
      vi.mocked(graphSessionManager.recordEvent).mockResolvedValue(undefined);
      vi.mocked(graphSessionManager.setArtifactCache).mockResolvedValue(undefined);

      const result = await artifactService.createArtifact(mockRequest);

      expect(result).toEqual({
        artifactId: 'test-artifact',
        toolCallId: 'test-tool-call',
        name: 'Processing...',
        description: 'Name and description being generated...',
        type: 'TestComponent',
        artifactSummary: {
          title: 'Test Title',
          summary: 'Test Summary',
        },
      });

      expect(graphSessionManager.recordEvent).toHaveBeenCalledWith(
        'test-stream-request',
        'artifact_saved',
        'test-agent',
        expect.objectContaining({
          artifactId: 'test-artifact',
          artifactType: 'TestComponent',
          pendingGeneration: true,
        })
      );
    });

    it('should handle array results by selecting first item', async () => {
      const mockToolResult = {
        toolCallId: 'test-tool-call',
        toolName: 'test-tool',
        timestamp: Date.now(),
        result: {
          data: [
            { title: 'First', summary: 'First Summary' },
            { title: 'Second', summary: 'Second Summary' },
          ],
        },
      };

      vi.mocked(toolSessionManager.getToolResult).mockReturnValue(mockToolResult);
      vi.mocked(graphSessionManager.recordEvent).mockResolvedValue(undefined);
      vi.mocked(graphSessionManager.setArtifactCache).mockResolvedValue(undefined);

      const result = await artifactService.createArtifact(mockRequest);

      expect(result?.artifactSummary).toEqual({
        title: 'First',
        summary: 'First Summary',
      });
    });

    it('should handle missing tool result', async () => {
      vi.mocked(toolSessionManager.getToolResult).mockReturnValue(undefined);

      const result = await artifactService.createArtifact(mockRequest);

      expect(result).toBeNull();
    });

    it('should handle missing session ID', async () => {
      const serviceWithoutSession = new ArtifactService({
        ...mockContext,
        sessionId: undefined,
      });

      const result = await serviceWithoutSession.createArtifact(mockRequest);

      expect(result).toBeNull();
    });

    it('should handle JMESPath selector errors gracefully', async () => {
      const mockToolResult = {
        toolCallId: 'test-tool-call',
        toolName: 'test-tool',
        timestamp: Date.now(),
        result: { data: 'simple string' },
      };

      vi.mocked(toolSessionManager.getToolResult).mockReturnValue(mockToolResult);
      vi.mocked(graphSessionManager.recordEvent).mockResolvedValue(undefined);

      const result = await artifactService.createArtifact({
        ...mockRequest,
        baseSelector: 'result.nonexistent[0]',
      });

      expect(result?.artifactSummary).toEqual({});
    });

    it('should sanitize JMESPath selectors correctly', async () => {
      const mockToolResult = {
        toolCallId: 'test-tool-call',
        toolName: 'test-tool',
        timestamp: Date.now(),
        result: {
          data: [{ title: 'Test', content: 'Test Content' }],
        },
      };

      vi.mocked(toolSessionManager.getToolResult).mockReturnValue(mockToolResult);
      vi.mocked(graphSessionManager.recordEvent).mockResolvedValue(undefined);

      const result = await artifactService.createArtifact({
        ...mockRequest,
        baseSelector: 'result.data[?title=="Test"]', // Double quotes should be sanitized
      });

      expect(result).not.toBeNull();
    });
  });

  describe('getArtifactData', () => {
    it('should return cached artifact from graph session', async () => {
      const mockCachedArtifact = {
        name: 'Cached Artifact',
        description: 'Cached Description',
        parts: [{ data: { summary: { test: 'data' } } }],
        metadata: { artifactType: 'TestType' },
      };

      vi.mocked(graphSessionManager.getArtifactCache).mockResolvedValue(mockCachedArtifact);

      const result = await artifactService.getArtifactData('test-artifact', 'test-tool-call');

      expect(result).toEqual({
        artifactId: 'test-artifact',
        toolCallId: 'test-tool-call',
        name: 'Cached Artifact',
        description: 'Cached Description',
        type: 'TestType',
        artifactSummary: { test: 'data' },
      });
    });

    it('should return artifact from provided map when not in cache', async () => {
      vi.mocked(graphSessionManager.getArtifactCache).mockResolvedValue(null);

      const artifactMap = new Map();
      const mockArtifact = {
        name: 'Map Artifact',
        description: 'Map Description',
        parts: [{ data: { summary: { map: 'data' } } }],
        metadata: { artifactType: 'MapType' },
      };
      artifactMap.set('test-artifact:test-tool-call', mockArtifact);

      const result = await artifactService.getArtifactData(
        'test-artifact',
        'test-tool-call',
        artifactMap
      );

      expect(result).toEqual({
        artifactId: 'test-artifact',
        toolCallId: 'test-tool-call',
        name: 'Map Artifact',
        description: 'Map Description',
        type: 'MapType',
        artifactSummary: { map: 'data' },
      });
    });

    it('should fetch from database when not in cache or map', async () => {
      vi.mocked(graphSessionManager.getArtifactCache).mockResolvedValue(null);

      const mockDbArtifact = {
        artifactId: 'test-artifact',
        name: 'DB Artifact',
        description: 'DB Description',
        parts: [{ kind: 'data' as const, data: { summary: { db: 'data' } } }],
        metadata: { artifactType: 'DBType' },
      };
      vi.mocked(getLedgerArtifacts).mockReturnValue(() => Promise.resolve([mockDbArtifact]));

      const result = await artifactService.getArtifactData('test-artifact', 'test-tool-call');

      expect(result).toEqual({
        artifactId: 'test-artifact',
        toolCallId: 'test-tool-call',
        name: 'DB Artifact',
        description: 'DB Description',
        type: 'DBType',
        artifactSummary: { db: 'data' },
      });

      expect(getLedgerArtifacts).toHaveBeenCalledWith('mock-db-client');
    });

    it('should return null when artifact not found anywhere', async () => {
      vi.mocked(graphSessionManager.getArtifactCache).mockResolvedValue(null);
      vi.mocked(getLedgerArtifacts).mockReturnValue(() => Promise.resolve([]));

      const result = await artifactService.getArtifactData('missing-artifact', 'missing-tool-call');

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(graphSessionManager.getArtifactCache).mockResolvedValue(null);
      vi.mocked(getLedgerArtifacts).mockReturnValue(() =>
        Promise.reject(new Error('Database error'))
      );

      const result = await artifactService.getArtifactData('test-artifact', 'test-tool-call');

      expect(result).toBeNull();
    });

    it('should return null when missing required context', async () => {
      const serviceWithoutContext = new ArtifactService({
        ...mockContext,
        projectId: undefined,
        taskId: undefined,
      });

      vi.mocked(graphSessionManager.getArtifactCache).mockResolvedValue(null);

      const result = await serviceWithoutContext.getArtifactData('test-artifact', 'test-tool-call');

      expect(result).toBeNull();
    });
  });

  describe('JMESPath sanitization', () => {
    it('should fix double quotes in filter expressions', async () => {
      const mockToolResult = {
        toolCallId: 'test-tool-call',
        toolName: 'test-tool',
        timestamp: Date.now(),
        result: {
          data: [{ type: 'test', title: 'Test Title' }],
        },
      };

      vi.mocked(toolSessionManager.getToolResult).mockReturnValue(mockToolResult);
      vi.mocked(graphSessionManager.recordEvent).mockResolvedValue(undefined);

      const request: ArtifactCreateRequest = {
        artifactId: 'test',
        toolCallId: 'test',
        type: 'TestComponent',
        baseSelector: 'result.data[?type=="test"]', // Should be sanitized to single quotes
        summaryProps: { title: 'title' },
      };

      const result = await artifactService.createArtifact(request);

      expect(result).not.toBeNull();
      expect(result?.artifactSummary.title).toBe('Test Title');
    });

    it('should fix contains syntax with @ references', async () => {
      const mockToolResult = {
        toolCallId: 'test-tool-call',
        toolName: 'test-tool',
        timestamp: Date.now(),
        result: {
          data: [{ content: 'test content', title: 'Test Title' }],
        },
      };

      vi.mocked(toolSessionManager.getToolResult).mockReturnValue(mockToolResult);
      vi.mocked(graphSessionManager.recordEvent).mockResolvedValue(undefined);

      const request: ArtifactCreateRequest = {
        artifactId: 'test',
        toolCallId: 'test',
        type: 'TestComponent',
        baseSelector: 'result.data[?content ~ contains(@, "test")]', // Should be sanitized
        summaryProps: { title: 'title' },
      };

      const result = await artifactService.createArtifact(request);

      expect(result).not.toBeNull();
    });
  });

  describe('schema filtering', () => {
    it('should filter properties based on component schema', async () => {
      const mockToolResult = {
        toolCallId: 'test-tool-call',
        toolName: 'test-tool',
        timestamp: Date.now(),
        result: {
          data: [
            {
              title: 'Test Title',
              summary: 'Test Summary',
              extraField: 'Should be filtered out',
            },
          ],
        },
      };

      vi.mocked(toolSessionManager.getToolResult).mockReturnValue(mockToolResult);
      vi.mocked(graphSessionManager.recordEvent).mockResolvedValue(undefined);

      const testRequest: ArtifactCreateRequest = {
        artifactId: 'test-artifact',
        toolCallId: 'test-tool-call',
        type: 'TestComponent',
        baseSelector: 'result.data[0]',
        summaryProps: { title: 'title', summary: 'summary' },
        fullProps: { content: 'content', details: 'details' },
      };

      const result = await artifactService.createArtifact(testRequest);

      expect(result?.artifactSummary).toEqual({
        title: 'Test Title',
        summary: 'Test Summary',
      });
      expect(result?.artifactSummary.extraField).toBeUndefined();
    });

    it('should handle missing schema properties gracefully', async () => {
      const mockToolResult = {
        toolCallId: 'test-tool-call',
        toolName: 'test-tool',
        timestamp: Date.now(),
        result: {
          data: [
            {
              title: 'Test Title',
              summary: 'Test Summary',
            },
          ],
        },
      };

      vi.mocked(toolSessionManager.getToolResult).mockReturnValue(mockToolResult);
      vi.mocked(graphSessionManager.recordEvent).mockResolvedValue(undefined);

      const serviceWithoutComponents = new ArtifactService({
        ...mockContext,
        artifactComponents: undefined,
      });

      const testRequest2: ArtifactCreateRequest = {
        artifactId: 'test-artifact',
        toolCallId: 'test-tool-call',
        type: 'TestComponent',
        baseSelector: 'result.data[0]',
        summaryProps: { title: 'title', summary: 'summary' },
        fullProps: { content: 'content', details: 'details' },
      };

      const result = await serviceWithoutComponents.createArtifact(testRequest2);

      expect(result?.artifactSummary).toEqual({
        title: 'Test Title',
        summary: 'Test Summary',
      });
    });
  });
});
