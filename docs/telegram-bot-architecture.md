# Arquitectura del Bot de Telegram

## Resumen

Sistema de bot de Telegram propietario para ingesta de documentos al sistema ChefChek. Los usuarios pueden enviar facturas, recibos y otros documentos directamente vía Telegram, y el sistema los procesa automáticamente para extracción de datos.

## Arquitectura del Sistema

### Componentes Principales

```
Bot de Telegram
├── Webhook Handler
│   ├── Recepción de mensajes
│   ├── Validación de seguridad
│   ├── Detección de tipo de mensaje
│   └── Enrutamiento de contenido
├── File Processor
│   ├── Descarga de archivos
│   ├── Validación de tipo/size
│   ├── Almacenamiento local
│   └── Enqueue para procesamiento
├── Processing Queue
│   ├── Prioridad de items
│   ├── Status tracking
│   ├── Retry logic
│   └── Worker assignment
└── Telegram Bot API
    ├── Mensajes enviados
    ├── Auto-reply
    ├── Notificaciones de progreso
    └── Mensajes de error
```

### Flujo de Ingesta

```
1. Usuario envía documento a Telegram
   ├── Mensaje llega al bot
   ├── Webhook recibe update
   ├── Valida secret token
   └── Procesa mensaje

2. Detección y Descarga
   ├── Detecta tipo de mensaje (texto, foto, documento)
   ├── Obtiene info del archivo
   ├── Descarga archivo localmente
   └── Crea registro en DB

3. Enqueue para Procesamiento
   ├── Calcula prioridad
   ├── Añade a cola de procesamiento
   ├── Set status PENDING
   └── Notifica usuario

4. Procesamiento Async
   ├── Worker pick item de cola
   ├── Extrae datos del archivo
   ├── Actualiza status
   └── Notifica resultado

5. Notificación al Usuario
   ├── Mensaje de éxito
   ├── Resumen de datos extraídos
   └── Opción de revisar/editar
```

## Configuración del Bot

### Registro del Bot

1. Contactar a @BotFather en Telegram
2. Comando `/newbot`
3. Seguir instrucciones para crear bot
4. Recibir bot token (formato: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
5. Configurar webhook URL
6. Opcional: Configurar secret token

### Configuración de Webhook

```typescript
interface TelegramBotConfig {
  botToken: string;          // Token del bot
  botUsername: string;       // @username del bot
  webhookUrl: string;        // URL pública del webhook
  secretToken?: string;      // Token opcional para validación
  enableFileUpload: boolean; // Habilitar subida de archivos
  enableTextMessages: boolean; // Habilitar mensajes de texto
  enableAutoReply: boolean;  // Respuesta automática
  welcomeMessage?: string;  // Mensaje de bienvenida
  helpMessage?: string;     // Mensaje de ayuda
}
```

### Tipos de Mensajes Soportados

```typescript
enum TelegramMessageType {
  TEXT = 'text',        // Mensajes de texto
  PHOTO = 'photo',      // Fotos enviadas
  DOCUMENT = 'document', // Documentos PDF, DOC, etc.
  CONTACT = 'contact',  // Contactos (no usado actualmente)
  LOCATION = 'location', // Ubicación (no usado actualmente)
}
```

## Seguridad de Webhooks

### Validación de Secret Token

```typescript
async function validateWebhookRequest(
  headers: Headers,
  config: TelegramBotConfig
): Promise<boolean> {
  const secretToken = headers.get('x-telegram-bot-api-secret-token');

  if (!config.secretToken) {
    return true;
  }

  return secretToken === config.secretToken;
}
```

### Asociar Mensajes a Tenants

```typescript
async function getTenantByChatId(chatId: number): Promise<string> {
  const mapping = await getChatToTenantMapping(chatId);

  if (!mapping) {
    throw new Error('Chat no asociado a ningún tenant');
  }

  return mapping.tenantId;
}
```

### Registro de Chat en Tenant

```typescript
async function registerChatInTenant(
  tenantId: string,
  chatId: number
): Promise<void> {
  const existing = await getChatToTenantMapping(chatId);

  if (existing && existing.tenantId !== tenantId) {
    throw new Error('Chat ya asociado a otro tenant');
  }

  if (!existing) {
    await createChatToTenantMapping({
      chatId,
      tenantId,
      registeredAt: new Date(),
      userId: getCurrentUserId(),
    });
  }
}
```

## Procesamiento de Archivos

### Detección de Tipo de Archivo

```typescript
function detectFileType(mimeType: string): FileType {
  const typeMap = {
    'image/jpeg': FileType.IMAGE,
    'image/png': FileType.IMAGE,
    'image/webp': FileType.IMAGE,
    'application/pdf': FileType.PDF,
    'application/msword': FileType.DOCUMENT,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileType.DOCUMENT,
    'application/vnd.ms-excel': FileType.SPREADSHEET,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileType.SPREADSHEET,
  };

  return typeMap[mimeType] || FileType.DOCUMENT;
}
```

### Validación de Archivos

```typescript
interface FileSecurityConfig {
  enableVirusScan: boolean;
  enableFileSizeValidation: boolean;
  maxFileSize: number; // bytes
  allowedMimeTypes: string[];
  enableTypeValidation: boolean;
}

function validateFile(
  file: IngestedFile,
  config: FileSecurityConfig
): ValidationResult {
  const errors: string[] = [];

  if (config.enableFileSizeValidation && file.fileSize > config.maxFileSize) {
    errors.push(`Archivo demasiado grande (${file.fileSize} > ${config.maxFileSize})`);
  }

  if (config.enableTypeValidation && !config.allowedMimeTypes.includes(file.mimeType)) {
    errors.push(`Tipo MIME no permitido: ${file.mimeType}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

### Almacenamiento de Archivos

```typescript
async function storeFileLocally(
  file: IngestedFile,
  fileBuffer: Buffer
): Promise<string> {
  const uploadsDir = '/tmp/chefchek';
  await ensureDir(uploadsDir);

  const extension = getFileExtension(file.mimeType);
  const localPath = `${uploadsDir}/${file.id}.${extension}`;

  await Bun.write(localPath, fileBuffer);

  return localPath;
}
```

## Sistema de Cola de Procesamiento

### Priorización de Archivos

```typescript
function calculatePriority(file: IngestedFile): number {
  let priority = 5; // Default priority

  // Factores de prioridad
  if (file.fileType === FileType.INVOICE) priority += 3; // Facturas urgentes
  if (file.fileType === FileType.RECEIPT) priority += 2; // Recibos importantes
  if (file.fileType === FileType.IMAGE) priority += 1; // Imágenes rápidas

  // Penalización por tamaño
  if (file.fileSize > 10 * 1024 * 1024) priority -= 2; // Archivos grandes más lentos
  if (file.fileSize > 50 * 1024 * 1024) priority -= 2;

  return Math.max(1, Math.min(10, priority)); // Clamp entre 1-10
}
```

### Gestión de Cola

```typescript
interface ProcessingQueue {
  items: Map<string, ProcessingQueueItem>;
  add: (item: ProcessingQueueItem) => void;
  remove: (itemId: string) => void;
  get: (itemId: string) => ProcessingQueueItem | undefined;
  getAll: () => ProcessingQueueItem[];
  getNext: (limit?: number) => ProcessingQueueItem[];
  updateStatus: (itemId: string, status: FileProcessingStatus) => void;
}
```

### Worker de Procesamiento

```typescript
async function processQueueWorker(): Promise<void> {
  setInterval(async () => {
    const items = queue.getNext(5); // Process up to 5 items

    for (const item of items) {
      await processQueueItem(item);
    }
  }, 5000); // Check every 5 seconds
}
```

## Retry Logic

```typescript
async function retryFailedFile(fileId: string): Promise<void> {
  const file = await getIngestedFile(fileId);

  if (!file) {
    throw new Error('Archivo no encontrado');
  }

  if (file.status !== FileProcessingStatus.FAILED) {
    throw new Error('El archivo no ha fallado');
  }

  if (file.retryCount >= 3) {
    throw new Error('Máximo número de reintentos alcanzado');
  }

  await updateFileStatus(fileId, {
    status: FileProcessingStatus.RETRYING,
  });

  // Re-add to queue
  const queueItem = getQueueItemByFileId(fileId);
  if (queueItem) {
    queueItem.status = FileProcessingStatus.PENDING;
    queueItem.queuedAt = new Date();
    await saveQueueItem(queueItem);
  }
}
```

## Auto-Reply System

### Respuestas Automáticas

```typescript
interface AutoReplyConfig {
  enableAutoReply: boolean;
  welcomeMessage?: string;
  helpMessage?: string;
  successMessage?: string;
  errorMessage?: string;
}

async function sendAutoReply(
  chatId: number,
  message: TelegramMessage,
  config: AutoReplyConfig
): Promise<void> {
  let replyText = '';

  if (message.messageType === TelegramMessageType.PHOTO || 
      message.messageType === TelegramMessageType.DOCUMENT) {
    const fileCount = message.fileIds?.length || 0;
    replyText = `✅ Recibido: ${fileCount} archivo(s).\n\n`;
    replyText += config.successMessage || 'Procesando archivo(s)... Te notificaré cuando termine.';
  } else if (message.messageType === TelegramMessageType.TEXT) {
    replyText = config.helpMessage || 'Gracias por tu mensaje. Estoy procesando la información.';
  }

  await bot.sendMessage(chatId, replyText);
}
```

### Notificaciones de Progreso

```typescript
async function sendProgressNotification(
  chatId: number,
  file: IngestedFile,
  progress: number
): Promise<void> {
  const emoji = progress === 100 ? '✅' : '⏳';
  const status = progress === 100 ? 'Completado' : `${progress}%`;

  const message = `${emoji} ${file.fileName}\n`;
  message += `Estado: ${status}\n`;

  if (progress === 100 && file.extractedData) {
    message += `\n📊 Datos extraídos correctamente.`;
  }

  await bot.sendMessage(chatId, message);
}
```

## Métricas y Monitoring

### Métricas de Uso

```typescript
interface IngestionStats {
  totalMessages: number;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  pendingFiles: number;
  averageProcessingTime: number; // milliseconds
  topFileTypes: {
    type: string;
    count: number;
    percentage: number;
  }[];
}
```

### Tracking de Events

```typescript
interface ProcessingEvent {
  fileId: string;
  eventType: 'queued' | 'started' | 'completed' | 'failed';
  timestamp: Date;
  metadata?: Record<string, any>;
}
```

## Manejo de Errores

### Tipos de Errores

```typescript
enum IngestionErrorType {
  INVALID_MESSAGE = 'invalid_message',
  FILE_TOO_LARGE = 'file_too_large',
  UNSUPPORTED_FILE_TYPE = 'unsupported_file_type',
  DOWNLOAD_FAILED = 'download_failed',
  PROCESSING_FAILED = 'processing_failed',
  EXTRACT_FAILED = 'extract_failed',
  QUEUE_FULL = 'queue_full',
}
```

### Respuesta de Error al Usuario

```typescript
async function handleProcessingError(
  chatId: number,
  file: IngestedFile,
  error: Error
): Promise<void> {
  const errorMessages = {
    [IngestionErrorType.FILE_TOO_LARGE]: 'El archivo es demasiado grande (máximo 10MB)',
    [IngestionErrorType.UNSUPPORTED_FILE_TYPE]: 'Formato de archivo no soportado',
    [IngestionErrorType.PROCESSING_FAILED]: 'Error procesando el archivo. Inténtalo de nuevo.',
    [IngestionErrorType.EXTRACT_FAILED]: 'Error extrayendo datos del archivo.',
  };

  const userMessage = errorMessages[error.type as IngestionErrorType] || 
    'Error inesperado. Por favor, contacta al soporte.';

  await bot.sendMessage(chatId, `❌ Error: ${userMessage}\n\nArchivo: ${file.fileName}`);
}
```

## Integraciones

### Con Sistema de OCR + IA

```typescript
interface OCRIntegration {
  processImage: (filePath: string) => Promise<OCRResult>;
  processPDF: (filePath: string) => Promise<OCRResult>;
}

interface AIIntegration {
  extractData: (text: string) => Promise<ExtractedData>;
  classifyDocument: (text: string) => Promise<DocumentType>;
}
```

### Con Sistema de Tenants

```typescript
interface TenantIntegration {
  getTenantByChatId: (chatId: number) => Promise<string>;
  registerChat: (tenantId: string, chatId: number) => Promise<void>;
  removeChat: (chatId: number) => Promise<void>;
}
```

## API Reference

### Webhook Endpoint

```http
POST /api/v1/telegram-ingestion/webhook
Headers:
  x-telegram-bot-api-secret-token: secret-token

Body: Telegram Update Object

Response 200:
{
  "success": true
}
```

### Initialize Bot

```http
POST /api/v1/telegram-ingestion/initialize-bot
Content-Type: application/json

{
  "botToken": "123456:ABC-DEF1234...",
  "botUsername": "@chefchek_bot",
  "webhookUrl": "https://chefchek.com/api/v1/telegram-ingestion/webhook",
  "secretToken": "your-secret-token",
  "enableFileUpload": true,
  "enableTextMessages": true,
  "enableAutoReply": true
}

Response 200:
{
  "message": "Bot inicializado correctamente"
}
```

## Checklist de Implementación

### Backend ✅
- [x] Webhook handler con validación de seguridad
- [x] Detección de tipos de mensajes y archivos
- [x] Descarga y almacenamiento local de archivos
- [x] Sistema de cola de procesamiento
- [x] Priorización de items
- [x] Retry logic
- [x] Auto-reply system
- [x] Tracking de métricas

### Frontend ✅
- [x] Dashboard de ingesta con 5 módulos
- [x] Vista de mensajes recibidos
- [x] Lista de archivos con estados
- [x] Cola de procesamiento en tiempo real
- [x] Estadísticas detalladas
- [x] Configuración del bot

### Pendiente
- [ ] Integración con sistema OCR + IA
- [ ] Integración con sistema de tenants
- [ ] Notificaciones push al dashboard
- [ ] Tests de integración

---

**Versión:** 1.0.0
**Última actualización:** 2026-05-31
**Estado:** ✅ Implementado
**Sprint:** 12 - Ingesta Omnicanal - Telegram Bot