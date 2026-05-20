import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Table } from 'dexie';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockLocalTablePut = vi.fn();
const mockLocalTableGet = vi.fn();
const mockLocalTableClear = vi.fn();
const mockSyncQueueAdd = vi.fn();
const mockProcessQueue = vi.fn();

vi.mock('@/lib/db', () => ({
  localDb: {
    sync_queue: { add: (...args: unknown[]) => mockSyncQueueAdd(...args) },
  },
}));

vi.mock('./SyncService', () => ({
  syncService: { processQueue: (...args: unknown[]) => mockProcessQueue(...args) },
}));

// ─── Implementação concreta para testes ─────────────────────────────────────

import { BaseResilientService } from './BaseResilientService';

interface TestEntity {
  id: string;
  nome: string;
  excluido?: boolean;
  excluido_em?: string;
}

class TestService extends BaseResilientService<TestEntity> {
  protected collectionName = 'test_entities';
  protected localTable = {
    put: (...args: unknown[]) => mockLocalTablePut(...args),
    get: (...args: unknown[]) => mockLocalTableGet(...args),
    clear: (...args: unknown[]) => mockLocalTableClear(...args),
  } as unknown as Table<TestEntity, string>;
}

const service = new TestService();

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('BaseResilientService.save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalTablePut.mockResolvedValue(undefined);
    mockSyncQueueAdd.mockResolvedValue(undefined);
    mockProcessQueue.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
  });

  it('persiste o dado localmente (put na tabela Dexie)', async () => {
    const entity: TestEntity = { id: 'ent-1', nome: 'Teste' };
    await service.save(entity);
    expect(mockLocalTablePut).toHaveBeenCalledWith(entity);
  });

  it('adiciona operação "update" na fila de sincronização', async () => {
    const entity: TestEntity = { id: 'ent-1', nome: 'Teste' };
    await service.save(entity);

    expect(mockSyncQueueAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'test_entities',
        action: 'update',
        data: entity,
        timestamp: expect.any(Number),
      })
    );
  });

  it('dispara processQueue quando está online', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    await service.save({ id: 'ent-1', nome: 'Teste' });
    // processQueue é chamado de forma assíncrona (fire-and-forget)
    await vi.waitFor(() => expect(mockProcessQueue).toHaveBeenCalled());
  });

  it('não dispara processQueue quando está offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
    await service.save({ id: 'ent-1', nome: 'Teste' });

    // Aguarda próximo tick para garantir que não houve chamada assíncrona
    await new Promise(res => setTimeout(res, 10));
    expect(mockProcessQueue).not.toHaveBeenCalled();
  });

  it('a persistência local ocorre antes da sincronização', async () => {
    const callOrder: string[] = [];
    mockLocalTablePut.mockImplementation(async () => { callOrder.push('put'); });
    mockSyncQueueAdd.mockImplementation(async () => { callOrder.push('syncAdd'); });

    await service.save({ id: 'ent-1', nome: 'Teste' });

    expect(callOrder[0]).toBe('put');
    expect(callOrder[1]).toBe('syncAdd');
  });
});

describe('BaseResilientService.delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalTablePut.mockResolvedValue(undefined);
    mockSyncQueueAdd.mockResolvedValue(undefined);
    mockProcessQueue.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
  });

  it('marca registro como excluido=true localmente (soft delete)', async () => {
    const existing: TestEntity = { id: 'ent-1', nome: 'Teste' };
    mockLocalTableGet.mockResolvedValue(existing);

    await service.delete('ent-1');

    expect(mockLocalTablePut).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ent-1',
        excluido: true,
        excluido_em: expect.any(String),
      })
    );
  });

  it('preserva os dados originais ao marcar como excluído', async () => {
    const existing: TestEntity = { id: 'ent-2', nome: 'Entidade Original' };
    mockLocalTableGet.mockResolvedValue(existing);

    await service.delete('ent-2');

    expect(mockLocalTablePut).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'Entidade Original' })
    );
  });

  it('adiciona operação "delete" na fila de sincronização', async () => {
    const existing: TestEntity = { id: 'ent-1', nome: 'Teste' };
    mockLocalTableGet.mockResolvedValue(existing);

    await service.delete('ent-1');

    expect(mockSyncQueueAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'test_entities',
        action: 'delete',
        data: { id: 'ent-1' },
      })
    );
  });

  it('não faz nada quando o registro não existe localmente', async () => {
    mockLocalTableGet.mockResolvedValue(undefined);

    await service.delete('id-inexistente');

    expect(mockLocalTablePut).not.toHaveBeenCalled();
    expect(mockSyncQueueAdd).not.toHaveBeenCalled();
  });

  it('excluido_em é uma ISO string válida', async () => {
    mockLocalTableGet.mockResolvedValue({ id: 'ent-1', nome: 'Teste' });

    await service.delete('ent-1');

    const excluidoEm = mockLocalTablePut.mock.calls[0][0].excluido_em;
    expect(() => new Date(excluidoEm)).not.toThrow();
    expect(new Date(excluidoEm).toISOString()).toBe(excluidoEm);
  });

  it('dispara processQueue quando está online após exclusão', async () => {
    mockLocalTableGet.mockResolvedValue({ id: 'ent-1', nome: 'Teste' });
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });

    await service.delete('ent-1');
    await vi.waitFor(() => expect(mockProcessQueue).toHaveBeenCalled());
  });

  it('não dispara processQueue quando está offline após exclusão', async () => {
    mockLocalTableGet.mockResolvedValue({ id: 'ent-1', nome: 'Teste' });
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

    await service.delete('ent-1');
    await new Promise(res => setTimeout(res, 10));
    expect(mockProcessQueue).not.toHaveBeenCalled();
  });
});

describe('BaseResilientService.getById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna registro da tabela local', async () => {
    const entity: TestEntity = { id: 'ent-1', nome: 'Teste' };
    mockLocalTableGet.mockResolvedValue(entity);

    const result = await service.getById('ent-1');

    expect(mockLocalTableGet).toHaveBeenCalledWith('ent-1');
    expect(result).toEqual(entity);
  });

  it('retorna undefined quando registro não existe', async () => {
    mockLocalTableGet.mockResolvedValue(undefined);

    const result = await service.getById('id-inexistente');

    expect(result).toBeUndefined();
  });
});

describe('BaseResilientService.clearLocal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('limpa todos os dados locais da tabela', async () => {
    mockLocalTableClear.mockResolvedValue(undefined);

    await service.clearLocal();

    expect(mockLocalTableClear).toHaveBeenCalled();
  });
});
