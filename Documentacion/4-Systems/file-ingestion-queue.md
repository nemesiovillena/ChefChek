# Sistema de Cola de Procesamiento de Archivos

## Resumen

Sistema robusto de cola de procesamiento asíncrono para archivos recibidos vía Telegram. Gestiona prioridades, reintentos, asignación de workers y seguimiento de progreso.

## Arquitectura de la Cola

### Componentes

```
Processing Queue System
├── Queue Manager
│   ├── Añadir items a cola
│   ├── Priorizar items
│   ├── Asignar workers
│   └── Monitorear progreso
├── Worker Pool
│   ├── Procesar items asignados
│   ├── Handle errores
│   ├── Reportar progreso
│   └── Retry logic
├── Status Tracker
│   ├── Estado de items
│   ├── Historial de eventos
│   ├── Métricas de rendimiento
│   └── Alertas de problemas
└── Retry Manager
    ├── Detectar fallos
    ├── Calcular delay de retry
    ├── Límite de reintentos
    └── Estrategia de backoff
```

## Modelo de Datos

### ProcessingQueueItem

```typescript
interface ProcessingQueueItem {
  id: string;
  fileId: string;
  tenantId: string;
  status: FileProcessingStatus;
  priority: number; // 1-10, 10 = highest
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  processingTime?: number; // milliseconds
  workerId?: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  errorMessage?: string;
}
```

### Estados de Procesamiento

```typescript
enum FileProcessingStatus {
  PENDING = 'pending',       // En cola, esperando ser procesado
  PROCESSING = 'processing', // Siendo procesado por worker
  COMPLETED = 'completed',   // Procesado exitosamente
  FAILED = 'failed',         // Fallo en procesamiento
  RETRYING = 'retrying',     // Esperando para reintentar
}
```

## Sistema de Prioridades

### Cálculo de Prioridad

```typescript
interface PriorityConfig {
  fileTypePriorities: Record<FileType, number>;
  sizePenaltyThreshold: number;
  sizePenaltyAmount: number;
  tenantPriorities?: Record<string, number>;
}

function calculatePriority(
  file: IngestedFile,
  config: PriorityConfig
): number {
  let priority = 5; // Default base priority

  // 1. Tipo de archivo
  priority += config.fileTypePriorities[file.fileType] || 0;

  // 2. Tamaño (penalty para archivos grandes)
  if (file.fileSize > config.sizePenaltyThreshold) {
    priority -= config.sizePenaltyAmount;
  }

  // 3. Prioridad específica del tenant
  if (config.tenantPriorities?.[file.tenantId]) {
    priority += config.tenantPriorities[file.tenantId];
  }

  // 4. Factores especiales
  if (file.fileType === FileType.INVOICE) priority += 3;
  if (file.fileType === FileType.RECEIPT) priority += 2;

  // Clamp entre 1-10
  return Math.max(1, Math.min(10, priority));
}
```

### Configuración de Prioridades

```typescript
const defaultPriorityConfig: PriorityConfig = {
  fileTypePriorities: {
    [FileType.INVOICE]: 3,
    [FileType.RECEIPT]: 2,
    [FileType.IMAGE]: 1,
    [FileType.PDF]: 1,
    [FileType.DOCUMENT]: 0,
    [FileType.SPREADSHEET]: 0,
  },
  sizePenaltyThreshold: 10 * 1024 * 1024, // 10MB
  sizePenaltyAmount: 2,
  tenantPriorities: {},
};
```

## Gestión de Workers

### Worker Pool

```typescript
interface WorkerConfig {
  maxConcurrentWorkers: number;
  workerIdleTimeout: number; // ms
  healthCheckInterval: number; // ms
}

interface Worker {
  id: string;
  status: 'idle' | 'processing' | 'error';
  currentItemId?: string;
  startedAt?: Date;
  itemsProcessed: number;
  itemsFailed: number;
  averageProcessingTime: number;
}

class WorkerPool {
  private workers: Map<string, Worker> = new Map();
  private config: WorkerConfig;

  constructor(config: WorkerConfig) {
    this.config = config;
  }

  async processNextItem(): Promise<void> {
    // Get idle worker
    const idleWorker = this.getIdleWorker();

    if (!idleWorker) {
      return; // All workers busy
    }

    // Get next item from queue
    const nextItem = await queue.getNextItem();

    if (!nextItem) {
      return; // Queue empty
    }

    // Assign item to worker
    await this.assignItemToWorker(idleWorker.id, nextItem);
  }

  private getIdleWorker(): Worker | undefined {
    return Array.from(this.workers.values()).find(
      (worker) => worker.status === 'idle'
    );
  }

  private async assignItemToWorker(
    workerId: string,
    item: ProcessingQueueItem
  ): Promise<void> {
    const worker = this.workers.get(workerId);

    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    worker.status = 'processing';
    worker.currentItemId = item.id;
    worker.startedAt = new Date();

    this.workers.set(workerId, worker);

    // Update queue item
    item.status = FileProcessingStatus.PROCESSING;
    item.startedAt = new Date();
    item.workerId = workerId;

    await updateQueueItem(item);

    // Process item
    try {
      await this.processItem(item);

      worker.status = 'idle';
      worker.currentItemId = undefined;
      worker.itemsProcessed++;

      this.workers.set(workerId, worker);
    } catch (error) {
      worker.status = 'idle';
      worker.currentItemId = undefined;
      worker.itemsFailed++;

      this.workers.set(workerId, worker);

      throw error;
    }
  }
}
```

## Sistema de Reintentos

### Estrategia de Backoff

```typescript
interface RetryConfig {
  maxRetries: number;
  initialDelay: number; // ms
  maxDelay: number; // ms
  backoffMultiplier: number;
  jitter: boolean;
}

function calculateRetryDelay(
  retryCount: number,
  config: RetryConfig
): number {
  // Exponential backoff
  let delay = config.initialDelay * Math.pow(config.backoffMultiplier, retryCount);

  // Cap at max delay
  delay = Math.min(delay, config.maxDelay);

  // Add jitter (randomness) to prevent thundering herd
  if (config.jitter) {
    delay = delay * (0.8 + Math.random() * 0.4);
  }

  return Math.round(delay);
}
```

### Retry Logic

```typescript
async function handleProcessingFailure(
  item: ProcessingQueueItem,
  error: Error,
  config: RetryConfig
): Promise<void> {
  item.retryCount++;

  if (item.retryCount >= config.maxRetries) {
    // Max retries reached, mark as failed
    item.status = FileProcessingStatus.FAILED;
    item.errorMessage = error.message;
    item.completedAt = new Date();
    item.processingTime = Date.now() - item.startedAt!.getTime();

    await updateQueueItem(item);

    // Notify user
    await notifyUserOfFailure(item, error);

    throw new Error(`Max retries reached for item ${item.id}`);
  }

  // Schedule retry
  item.status = FileProcessingStatus.RETRYING;
  item.errorMessage = error.message;
  item.nextRetryAt = new Date(Date.now() + calculateRetryDelay(item.retryCount, config));

  await updateQueueItem(item);

  // Schedule retry
  setTimeout(async () => {
    await retryItem(item.id);
  }, item.nextRetryAt.getTime() - Date.now());
}
```

## Tracking de Progreso

### Eventos de Procesamiento

```typescript
interface ProcessingEvent {
  id: string;
  queueItemId: string;
  eventType: 'queued' | 'started' | 'progress' | 'completed' | 'failed' | 'retried';
  timestamp: Date;
  metadata?: Record<string, any>;
  progress?: number; // 0-100
}

async function logProcessingEvent(
  queueItemId: string,
  eventType: ProcessingEvent['eventType'],
  metadata?: Record<string, any>,
  progress?: number
): Promise<void> {
  const event: ProcessingEvent = {
    id: uuidv4(),
    queueItemId,
    eventType,
    timestamp: new Date(),
    metadata,
    progress,
  };

  await processingEventRepository.save(event);
}
```

### Progreso en Tiempo Real

```typescript
async function updateProgress(
  queueItemId: string,
  progress: number,
  metadata?: Record<string, any>
): Promise<void> {
  await logProcessingEvent(queueItemId, 'progress', metadata, progress);

  // Notify client via WebSocket
  await broadcastProgress(queueItemId, progress);
}
```

## Métricas de Rendimiento

### Métricas de Cola

```typescript
interface QueueMetrics {
  totalItems: number;
  pendingItems: number;
  processingItems: number;
  completedItems: number;
  failedItems: number;
  averageWaitTime: number; // ms
  averageProcessingTime: number; // ms
  throughput: number; // items per minute
}

async function calculateQueueMetrics(tenantId: string): Promise<QueueMetrics> {
  const totalItems = await countQueueItems(tenantId);
  const pendingItems = await countQueueItemsByStatus(tenantId, FileProcessingStatus.PENDING);
  const processingItems = await countQueueItemsByStatus(tenantId, FileProcessingStatus.PROCESSING);
  const completedItems = await countQueueItemsByStatus(tenantId, FileProcessingStatus.COMPLETED);
  const failedItems = await countQueueItemsByStatus(tenantId, FileProcessingStatus.FAILED);

  const averageWaitTime = await calculateAverageWaitTime(tenantId);
  const averageProcessingTime = await calculateAverageProcessingTime(tenantId);
  const throughput = await calculateThroughput(tenantId);

  return {
    totalItems,
    pendingItems,
    processingItems,
    completedItems,
    failedItems,
    averageWaitTime,
    averageProcessingTime,
    throughput,
  };
}
```

### Cálculo de Throughput

```typescript
async function calculateThroughput(tenantId: string): Promise<number> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60000);

  const completedInLastMinute = await countCompletedItemsBetween(
    tenantId,
    oneMinuteAgo,
    now
  );

  return completedInLastMinute;
}
```

## Health Checks

### Health Check de Worker

```typescript
async function checkWorkerHealth(workerId: string): Promise<WorkerHealthStatus> {
  const worker = workers.get(workerId);

  if (!worker) {
    return {
      status: 'unhealthy',
      reason: 'Worker not found',
    };
  }

  const idleTime = Date.now() - worker.startedAt?.getTime() || 0;

  if (worker.status === 'processing' && idleTime > 300000) { // 5 minutes
    return {
      status: 'unhealthy',
      reason: 'Worker stuck processing',
    };
  }

  if (worker.status === 'processing' && worker.averageProcessingTime > 60000) {
    return {
      status: 'warning',
      reason: 'Worker processing slowly',
    };
  }

  return {
    status: 'healthy',
    reason: 'Worker operating normally',
  };
}
```

### Health Check de Cola

```typescript
async function checkQueueHealth(tenantId: string): Promise<QueueHealthStatus> {
  const metrics = await calculateQueueMetrics(tenantId);

  const issues: string[] = [];

  // Check for stuck items
  if (metrics.processingItems > 0) {
    const stuckItems = await getStuckProcessingItems(tenantId);
    if (stuckItems.length > 0) {
      issues.push(`${stuckItems.length} items stuck in processing`);
    }
  }

  // Check for queue backup
  if (metrics.pendingItems > 100) {
    issues.push('Queue backup detected');
  }

  // Check for high failure rate
  const failureRate = metrics.failedItems / metrics.completedItems;
  if (failureRate > 0.1) { // > 10% failure rate
    issues.push(`High failure rate: ${(failureRate * 100).toFixed(1)}%`);
  }

  return {
    status: issues.length > 0 ? 'warning' : 'healthy',
    issues,
    metrics,
  };
}
```

## Cleanup y Mantenimiento

### Cleanup de Items Completados

```typescript
async function cleanupCompletedItems(
  maxAge: number = 86400000 // 24 hours
): Promise<number> {
  const cutoffDate = new Date(Date.now() - maxAge);

  const completedItems = await getCompletedItemsBefore(cutoffDate);

  for (const item of completedItems) {
    await deleteQueueItem(item.id);
    await deleteProcessingEvents(item.id);
  }

  return completedItems.length;
}
```

### Cleanup de Eventos Antiguos

```typescript
async function cleanupOldEvents(
  maxAge: number = 604800000 // 7 days
): Promise<number> {
  const cutoffDate = new Date(Date.now() - maxAge);

  const oldEvents = await getProcessingEventsBefore(cutoffDate);

  for (const event of oldEvents) {
    await deleteProcessingEvent(event.id);
  }

  return oldEvents.length;
}
```

## API Reference

### Obtener Estado de Cola

```http
GET /api/v1/telegram-ingestion/queue?tenantId={tenantId}

Response 200:
{
  "items": [
    {
      "id": "uuid",
      "fileId": "uuid",
      "tenantId": "uuid",
      "status": "processing",
      "priority": 8,
      "queuedAt": "2026-05-31T12:00:00Z",
      "startedAt": "2026-05-31T12:01:00Z",
      "progress": 75
    }
  ]
}
```

### Procesar Cola Manualmente

```http
POST /api/v1/telegram-ingestion/process-queue

Response 200:
{
  "message": "Cola procesada correctamente"
}
```

### Obtener Métricas

```http
GET /api/v1/telegram-ingestion/queue/metrics?tenantId={tenantId}

Response 200:
{
  "totalItems": 145,
  "pendingItems": 23,
  "processingItems": 5,
  "completedItems": 115,
  "failedItems": 2,
  "averageWaitTime": 15000,
  "averageProcessingTime": 4500,
  "throughput": 12
}
```

## Checklist de Implementación

### Queue Manager ✅
- [x] Añadir items a cola
- [x] Sistema de prioridades
- [x] Get next item
- [x] Update status
- [x] Get queue status

### Worker Pool ✅
- [x] Max concurrent workers
- [x] Health checks
- [x] Worker assignment
- [x] Worker idle detection

### Retry Logic ✅
- [x] Exponential backoff
- [x] Jitter addition
- [x] Max retries limit
- [x] Scheduled retries

### Tracking ✅
- [x] Event logging
- [x] Progress tracking
- [x] Real-time updates
- [x] Metrics calculation

### Maintenance ✅
- [x] Cleanup old items
- [x] Cleanup old events
- [x] Health checks
- [x] Performance monitoring

---

**Versión:** 1.0.0
**Última actualización:** 2026-05-31
**Estado:** ✅ Implementado
**Sprint:** 12 - Ingesta Omnicanal - Telegram Bot