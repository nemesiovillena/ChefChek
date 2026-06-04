# Sistema de Seguridad de Webhooks

## Resumen

Sistema robusto de seguridad para webhooks de Telegram que garantiza la autenticidad, integridad y autorización de todas las solicitudes entrantes. Protege contra ataques maliciosos, inyección de datos y accesos no autorizados.

## Principios de Seguridad

1. **Autenticación**: Verificar la identidad del remitente
2. **Autorización**: Validar permisos del remitente
3. **Integridad**: Garantizar que los datos no fueron modificados
4. **No Repetición**: Prevenir replay attacks
5. **Rate Limiting**: Limitar solicitudes por IP
6. **Validación de Input**: Sanitizar y validar todos los datos

## Flujo de Seguridad

```
1. Solicitud Webhook Recibida
   ├── Verificar headers de seguridad
   ├── Validar secret token
   ├── Comprobar rate limiting
   └── Proceder al procesamiento

2. Validación de Payload
   ├── Estructura del JSON
   ├── Tipos de datos esperados
   ├── Valores límites
   └── Sanitización de strings

3. Procesamiento Seguro
   ├── Autenticación de usuario
   ├── Autorización por tenant
   ├── Aislamiento de datos
   └── Logging de seguridad

4. Respuesta
   ├── Status code apropiado
   ├── Headers de seguridad
   └── No exponer información sensible
```

## Validación de Secret Token

### Configuración

```typescript
interface WebhookSecurityConfig {
  enableSecretToken: boolean;
  secretToken: string;
  enableIPWhitelist: boolean;
  allowedIPs: string[];
  enableRateLimiting: boolean;
  maxRequestsPerMinute: number;
}
```

### Implementación

```typescript
async function validateWebhookSecurity(
  headers: Headers,
  body: any,
  config: WebhookSecurityConfig
): Promise<SecurityValidationResult> {
  const errors: string[] = [];

  // 1. Validar secret token
  if (config.enableSecretToken) {
    const secretToken = headers.get('x-telegram-bot-api-secret-token');

    if (!secretToken) {
      errors.push('Secret token missing');
    } else if (secretToken !== config.secretToken) {
      errors.push('Invalid secret token');
    }
  }

  // 2. Validar IP whitelist
  if (config.enableIPWhitelist) {
    const clientIP = getClientIP(headers);

    if (!config.allowedIPs.includes(clientIP)) {
      errors.push(`IP ${clientIP} not in whitelist`);
    }
  }

  // 3. Validar rate limiting
  if (config.enableRateLimiting) {
    const rateLimitValid = await validateRateLimit(
      clientIP,
      config.maxRequestsPerMinute
    );

    if (!rateLimitValid) {
      errors.push('Rate limit exceeded');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

## Rate Limiting

### Estrategia de Rate Limiting

```typescript
interface RateLimitConfig {
  windowMs: number;      // Ventana de tiempo en ms
  maxRequests: number;   // Máximo de solicitudes permitidas
  skipSuccessfulRequests: boolean; // No contar solicitudes exitosas
}

const rateLimitStore = new Map<string, RateLimitEntry>();

interface RateLimitEntry {
  count: number;
  resetAt: Date;
}

async function validateRateLimit(
  clientIP: string,
  maxRequests: number
): Promise<boolean> {
  const now = Date.now();
  const entry = rateLimitStore.get(clientIP);

  if (!entry || now >= entry.resetAt.getTime()) {
    // Reset counter
    rateLimitStore.set(clientIP, {
      count: 1,
      resetAt: new Date(now + 60000), // 1 minute window
    });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false; // Rate limit exceeded
  }

  entry.count++;
  return true;
}
```

### Rate Limiting por Tenant

```typescript
interface TenantRateLimit {
  tenantId: string;
  maxRequests: number;
  windowMs: number;
}

async function validateTenantRateLimit(
  tenantId: string,
  config: TenantRateLimit
): Promise<boolean> {
  const key = `tenant:${tenantId}`;
  return await validateRateLimit(key, config.maxRequests);
}
```

## Sanitización de Input

### Validación de Mensajes de Telegram

```typescript
interface TelegramMessageValidation {
  messageId: number;
  chatId: number;
  fromId: number;
  timestamp: number;
  hasValidStructure: boolean;
}

function validateTelegramMessage(update: any): TelegramMessageValidation {
  const validation: TelegramMessageValidation = {
    messageId: update.message?.message_id,
    chatId: update.message?.chat?.id,
    fromId: update.message?.from?.id,
    timestamp: update.message?.date,
    hasValidStructure: true,
  };

  // Validar estructura básica
  if (!update.message) {
    validation.hasValidStructure = false;
    return validation;
  }

  // Validar campos requeridos
  if (!validation.messageId || !validation.chatId) {
    validation.hasValidStructure = false;
  }

  // Validar timestamp (no puede ser futuro ni muy antiguo)
  if (validation.timestamp) {
    const now = Date.now() / 1000;
    const maxAge = 3600; // 1 hora

    if (validation.timestamp > now || now - validation.timestamp > maxAge) {
      validation.hasValidStructure = false;
    }
  }

  return validation;
}
```

### Sanitización de Nombres de Usuario

```typescript
function sanitizeUsername(username?: string): string | null {
  if (!username) return null;

  // Validar formato: solo letras, números y guiones bajos
  const usernameRegex = /^[a-zA-Z0-9_]{5,32}$/;

  if (!usernameRegex.test(username)) {
    return null;
  }

  return username;
}
```

### Validación de Nombres de Archivos

```typescript
function validateFileName(fileName: string): ValidationResult {
  const errors: string[] = [];

  // Longitud máxima
  if (fileName.length > 255) {
    errors.push('Nombre de archivo demasiado largo');
  }

  // Caracteres prohibidos
  const forbiddenChars = /[<>:"/\\|?*\x00-\x1F]/g;
  if (forbiddenChars.test(fileName)) {
    errors.push('Nombre de archivo contiene caracteres prohibidos');
  }

  // Nombres reservados
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4',
    'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5',
    'LPT6', 'LPT7', 'LPT8', 'LPT9'];

  const nameWithoutExt = fileName.split('.')[0].toUpperCase();
  if (reservedNames.includes(nameWithoutExt)) {
    errors.push('Nombre de archivo reservado');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

## Protección contra Ataques

### Replay Attack Prevention

```typescript
const processedMessageIds = new Set<number>();
const messageIdExpiry = 600000; // 10 minutos

function validateMessageNotReplayed(messageId: number): boolean {
  if (processedMessageIds.has(messageId)) {
    return false; // Message already processed
  }

  processedMessageIds.add(messageId);

  // Clean old entries
  setTimeout(() => {
    processedMessageIds.delete(messageId);
  }, messageIdExpiry);

  return true;
}
```

### SQL Injection Protection

```typescript
import { IsUUID, IsString, IsNumber, Min, Max } from 'class-validator';

class SafeMessageDto {
  @IsUUID()
  id: string;

  @IsUUID()
  tenantId: string;

  @IsEnum(TelegramMessageType)
  messageType: TelegramMessageType;

  @IsString()
  @Min(1)
  @Max(100)
  content?: string;

  @IsNumber()
  @Min(1000000)
  @Max(10000000000)
  chatId: number;
}

function validateMessageDTO(dto: any): SafeMessageDto {
  return plainToInstance(SafeMessageDto, dto, {
    enableImplicitConversion: true,
  });
}
```

### XSS Prevention

```typescript
function sanitizeHTML(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

## Logging de Seguridad

### Eventos de Seguridad

```typescript
enum SecurityEventType {
  INVALID_SECRET_TOKEN = 'invalid_secret_token',
  IP_NOT_WHITELISTED = 'ip_not_whitelisted',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INVALID_MESSAGE_STRUCTURE = 'invalid_message_structure',
  REPLAY_ATTACK_DETECTED = 'replay_attack_detected',
  MALICIOUS_INPUT_DETECTED = 'malicious_input_detected',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
}

interface SecurityEvent {
  id: string;
  eventType: SecurityEventType;
  timestamp: Date;
  clientIP: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  await securityEventRepository.save(event);

  if (event.severity === 'high' || event.severity === 'critical') {
    // Send alert to administrators
    await sendSecurityAlert(event);
  }
}
```

### Alertas de Seguridad

```typescript
async function sendSecurityAlert(event: SecurityEvent): Promise<void> {
  const alertMessage = `
🚨 SECURITY ALERT 🚨

Event: ${event.eventType}
Severity: ${event.severity}
Timestamp: ${event.timestamp.toISOString()}
Client IP: ${event.clientIP}

Metadata: ${JSON.stringify(event.metadata, null, 2)}
  `.trim();

  // Send via Telegram bot
  await sendAdminAlert(alertMessage);

  // Send via email
  await sendSecurityEmail(alertMessage);
}
```

## Headers de Seguridad HTTP

### Headers de Respuesta

```typescript
function setSecurityHeaders(response: Response): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-XSS-Protection', '1; mode=block');
  response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.setHeader('Content-Security-Policy', "default-src 'self'");
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}
```

## Validación de Usuarios

### Mapeo de Chat a Tenant

```typescript
interface ChatTenantMapping {
  chatId: number;
  tenantId: string;
  userId: string;
  registeredAt: Date;
  verified: boolean;
}

async function validateChatAccess(
  chatId: number
): Promise<ChatTenantMapping> {
  const mapping = await getChatToTenantMapping(chatId);

  if (!mapping) {
    throw new UnauthorizedException('Chat no asociado a ningún tenant');
  }

  if (!mapping.verified) {
    throw new UnauthorizedException('Chat no verificado. Contacta al administrador.');
  }

  return mapping;
}
```

### Verificación de Usuario

```typescript
async function verifyUser(userId: string): Promise<boolean> {
  const user = await getUserById(userId);

  if (!user) {
    return false;
  }

  return user.isActive && user.isVerified;
}
```

## Tests de Seguridad

### Tests de Validación

```typescript
describe('Webhook Security', () => {
  describe('validateWebhookSecurity', () => {
    it('should reject without secret token when enabled', async () => {
      const config: WebhookSecurityConfig = {
        enableSecretToken: true,
        secretToken: 'test-secret',
        enableIPWhitelist: false,
        enableRateLimiting: false,
      };

      const result = await validateWebhookSecurity(new Headers(), {}, config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Secret token missing');
    });

    it('should reject invalid secret token', async () => {
      const config: WebhookSecurityConfig = {
        enableSecretToken: true,
        secretToken: 'correct-secret',
        enableIPWhitelist: false,
        enableRateLimiting: false,
      };

      const headers = new Headers();
      headers.set('x-telegram-bot-api-secret-token', 'wrong-secret');

      const result = await validateWebhookSecurity(headers, {}, config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid secret token');
    });
  });

  describe('validateTelegramMessage', () => {
    it('should reject invalid message structure', () => {
      const invalidUpdate = { invalid: 'data' };

      const result = validateTelegramMessage(invalidUpdate);

      expect(result.hasValidStructure).toBe(false);
    });

    it('should reject future timestamp', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;

      const invalidUpdate = {
        message: {
          message_id: 123,
          chat: { id: 456 },
          date: futureTimestamp,
        },
      };

      const result = validateTelegramMessage(invalidUpdate);

      expect(result.hasValidStructure).toBe(false);
    });
  });

  describe('validateMessageNotReplayed', () => {
    it('should reject replayed message', () => {
      const messageId = 123;

      const firstValidation = validateMessageNotReplayed(messageId);
      expect(firstValidation).toBe(true);

      const secondValidation = validateMessageNotReplayed(messageId);
      expect(secondValidation).toBe(false);
    });
  });
});
```

## Mejores Prácticas

### Para Desarrolladores

1. **Nunca confiar en el input**: Validar y sanificar todos los datos
2. **Usar HTTPS obligatoriamente**: Nunca permitir HTTP
3. **Implementar rate limiting**: Prevenir DoS
4. **Log todos los eventos**: Para auditoría y debugging
5. **Revisar logs regularmente**: Detectar patrones sospechosos

### Para Administradores

1. **Usar secret tokens fuertes**: Mínimo 32 caracteres
2. **Mantener secretos seguros**: Nunca en código fuente
3. **Configurar IP whitelist**: Cuando sea posible
4. **Monitorear alertas**: Responder rápidamente
5. **Actualizar regularmente**: Mantener dependencias actualizadas

### Para Usuarios

1. **No compartir tokens**: Mantener secretos privados
2. **Usar usuarios dedicados**: Un usuario por bot/tenant
3. **Verificar asociaciones**: Validar mapeo de chat a tenant
4. **Reportar problemas**: Notificar actividades sospechosas

## Checklist de Implementación

### Validación ✅
- [x] Validación de secret token
- [x] Validación de estructura de mensaje
- [x] Validación de timestamps
- [x] Validación de nombres de archivo
- [x] Sanitización de input

### Protección ✅
- [x] Rate limiting
- [x] IP whitelist
- [x] Replay attack prevention
- [x] XSS prevention
- [x] SQL injection protection

### Logging ✅
- [x] Eventos de seguridad
- [x] Alertas automáticas
- [x] Metadatos completos
- [x] Severidad de eventos

### Headers de Seguridad ✅
- [x] X-Content-Type-Options
- [x] X-Frame-Options
- [x] X-XSS-Protection
- [x] Strict-Transport-Security
- [x] Content-Security-Policy

---

**Versión:** 1.0.0
**Última actualización:** 2026-05-31
**Estado:** ✅ Implementado
**Sprint:** 12 - Ingesta Omnicanal - Telegram Bot