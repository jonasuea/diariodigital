import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks hoistados (devem ser declarados antes do vi.mock para funcionar) ──

const { mockToArray, mockOrderBy, mockSyncQueueDelete, mockSetDocument, mockUpdateDocument } = vi.hoisted(() => {
  const mockToArray = vi.fn();
  const mockOrderBy = vi.fn(() => ({ toArray: mockToArray }));
  const mockSyncQueueDelete = vi.fn();
  const mockSetDocument = vi.fn();
  const mockUpdateDocument = vi.fn();
  return { mockToArray, mockOrderBy, mockSyncQueueDelete, mockSetDocument, mockUpdateDocument };
});

vi.mock('@/lib/db', () => ({
  localDb: {
    sync_queue: {
      orderBy: mockOrderBy,
      delete: mockSyncQueueDelete,
    },
  },
}));

vi.mock('@/facades/FirebaseFacade', () => ({
  FirebaseFacade: {
    setDocument: (...args: unknown[]) => mockSetDocument(...args),
    updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
  },
}));

import { syncService } from './SyncService';

// ─── Helper ──────────────────────────────────────────────────────────────────

function makePendingOp(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    collection: 'frequencias',
    action: 'update' as const,
    data: { id: 'freq-1', turma_id: 't-1' },
    timestamp: Date.now(),
    ...overrides,
  };
}

// ─── processQueue ────────────────────────────────────────────────────────────

describe('SyncService.processQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    // Reconfigurar mockOrderBy após clearAllMocks
    mockOrderBy.mockReturnValue({ toArray: mockToArray });
  });

  it('não faz nada quando está offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

    await syncService.processQueue();

    expect(mockOrderBy).not.toHaveBeenCalled();
  });

  it('não faz nada quando a fila está vazia', async () => {
    mockToArray.mockResolvedValue([]);

    await syncService.processQueue();

    expect(mockSetDocument).not.toHaveBeenCalled();
    expect(mockUpdateDocument).not.toHaveBeenCalled();
  });

  it('processa operação de update e remove da fila após sucesso', async () => {
    const op = makePendingOp({ action: 'update' });
    mockToArray.mockResolvedValue([op]);
    mockSetDocument.mockResolvedValue(undefined);
    mockSyncQueueDelete.mockResolvedValue(undefined);

    await syncService.processQueue();

    expect(mockSetDocument).toHaveBeenCalledWith(
      'frequencias',
      'freq-1',
      expect.objectContaining({ id: 'freq-1', last_sync: expect.any(String) }),
      true
    );
    expect(mockSyncQueueDelete).toHaveBeenCalledWith(1);
  });

  it('processa operação de create com merge (setDocument merge=true)', async () => {
    const op = makePendingOp({ action: 'create' });
    mockToArray.mockResolvedValue([op]);
    mockSetDocument.mockResolvedValue(undefined);
    mockSyncQueueDelete.mockResolvedValue(undefined);

    await syncService.processQueue();

    expect(mockSetDocument).toHaveBeenCalledWith(
      'frequencias', 'freq-1', expect.any(Object), true
    );
  });

  it('processa exclusão lógica (soft delete) usando updateDocument', async () => {
    const op = makePendingOp({ action: 'delete', data: { id: 'freq-1' } });
    mockToArray.mockResolvedValue([op]);
    mockUpdateDocument.mockResolvedValue(undefined);
    mockSyncQueueDelete.mockResolvedValue(undefined);

    await syncService.processQueue();

    expect(mockUpdateDocument).toHaveBeenCalledWith(
      'frequencias',
      'freq-1',
      expect.objectContaining({
        excluido: true,
        excluido_em: expect.any(String),
        excluido_por_sync: true,
      })
    );
    expect(mockSyncQueueDelete).toHaveBeenCalledWith(1);
  });

  it('remove item com permission-denied da fila e continua processando', async () => {
    const op1 = makePendingOp({ id: 1, data: { id: 'freq-1' } });
    const op2 = makePendingOp({ id: 2, data: { id: 'freq-2' } });
    mockToArray.mockResolvedValue([op1, op2]);

    const permissionError = Object.assign(new Error('permission denied'), { code: 'permission-denied' });
    mockSetDocument
      .mockRejectedValueOnce(permissionError)
      .mockResolvedValueOnce(undefined);
    mockSyncQueueDelete.mockResolvedValue(undefined);

    await syncService.processQueue();

    // op1 deve ser removido da fila (não irá ter retry)
    expect(mockSyncQueueDelete).toHaveBeenCalledWith(1);
    // op2 também deve ter sido processado
    expect(mockSetDocument).toHaveBeenCalledTimes(2);
  });

  it('interrompe o loop ao encontrar erro genérico de rede', async () => {
    const op1 = makePendingOp({ id: 1, data: { id: 'freq-1' } });
    const op2 = makePendingOp({ id: 2, data: { id: 'freq-2' } });
    mockToArray.mockResolvedValue([op1, op2]);

    const networkError = new Error('Network request failed');
    mockSetDocument.mockRejectedValue(networkError);

    await syncService.processQueue();

    // Apenas op1 foi tentado (interrompeu o loop)
    expect(mockSetDocument).toHaveBeenCalledTimes(1);
    // op1 não deve ser removido da fila para que possa ser retentado
    expect(mockSyncQueueDelete).not.toHaveBeenCalled();
  });

  it('item sem ID não é removido da fila (erro capturado internamente)', async () => {
    const opSemId = { id: 1, collection: 'frequencias', action: 'update', data: {}, timestamp: Date.now() };
    mockToArray.mockResolvedValue([opSemId]);

    await expect(syncService.processQueue()).resolves.toBeUndefined();
    expect(mockSyncQueueDelete).not.toHaveBeenCalled();
  });

  it('processa múltiplas operações em sequência', async () => {
    const ops = [
      makePendingOp({ id: 1, data: { id: 'freq-1' } }),
      makePendingOp({ id: 2, data: { id: 'freq-2' } }),
      makePendingOp({ id: 3, data: { id: 'freq-3' } }),
    ];
    mockToArray.mockResolvedValue(ops);
    mockSetDocument.mockResolvedValue(undefined);
    mockSyncQueueDelete.mockResolvedValue(undefined);

    await syncService.processQueue();

    expect(mockSetDocument).toHaveBeenCalledTimes(3);
    expect(mockSyncQueueDelete).toHaveBeenCalledTimes(3);
  });

  it('last_sync é uma ISO string válida na operação sincronizada', async () => {
    mockToArray.mockResolvedValue([makePendingOp()]);
    mockSetDocument.mockResolvedValue(undefined);
    mockSyncQueueDelete.mockResolvedValue(undefined);

    await syncService.processQueue();

    const lastSyncValue = mockSetDocument.mock.calls[0][2].last_sync;
    expect(() => new Date(lastSyncValue)).not.toThrow();
    expect(new Date(lastSyncValue).toISOString()).toBe(lastSyncValue);
  });
});
