# Gestión del Conocimiento

## Resumen

Sistema integral de gestión del conocimiento que captura, organiza y distribuye el know-how de la cocina. Incluye documentación de procedimientos, mejores prácticas, lecciones aprendidas y transferencia de conocimiento.

## Ciclo del Conocimiento

### 1. Captura del Conocimiento

```
Identificación → Documentación → Validación → Publicación
```

**Fuentes de Conocimiento:**
- Procedimientos operativos
- Mejores prácticas descubiertas
- Lecciones aprendidas de incidentes
- Actualizaciones de regulaciones
- Feedback de clientes
- Innovaciones en procesos

**Métodos de Captura:**
- Documentación directa por chef
- Entrevistas con personal clave
- Observación en vivo
- Análisis de métricas y datos
- Benchmarking con competidores

### 2. Organización del Conocimiento

```
Categorización → Etiquetado → Indexación → Enlazado
```

**Estructura de Organización:**
- Por categoría funcional
- Por nivel de experiencia (básico, intermedio, avanzado)
- Por frecuencia de uso
- Por estación de trabajo
- Por temporalidad (procedimientos vs temporales)

### 3. Distribución del Conocimiento

```
Acceso → Formación → Aplicación → Feedback → Mejora
```

**Canales de Distribución:**
- Sistema wiki
- Sesiones de formación
- Manuales operativos
- Checklists en sitio
- Notificaciones push
- Búsqueda inteligente

## Transferencia de Conocimiento

### Onboarding de Nuevo Personal

```typescript
interface OnboardingPlan {
  userId: string;
  startDate: Date;
  role: UserRole;
  modules: OnboardingModule[];
  progress: number;
  completed: boolean;
}

interface OnboardingModule {
  moduleId: string;
  title: string;
  description: string;
  documentIds: string[];
  estimatedDuration: number; // minutes
  completed: boolean;
  completedAt?: Date;
  quizScore?: number;
}

async function createOnboardingPlan(
  userId: string,
  role: UserRole
): Promise<OnboardingPlan> {
  // Get role-specific modules
  const roleModules = await getRoleModules(role);
  
  const plan: OnboardingPlan = {
    id: uuidv4(),
    userId,
    startDate: new Date(),
    role,
    modules: roleModules.map((module) => ({
      ...module,
      completed: false,
    })),
    progress: 0,
    completed: false,
  };

  await this.onboardingPlanRepository.save(plan);

  // Notify user
  await notifyUser(userId, {
    type: 'onboarding_started',
    message: `Tu plan de onboarding para ${role} está listo`,
    modulesCount: roleModules.length,
  });

  return plan;
}
```

### Currículum de Formación

```typescript
interface Curriculum {
  role: UserRole;
  levels: CurriculumLevel[];
}

interface CurriculumLevel {
  level: number;
  title: string;
  description: string;
  prerequisites: string[];
  modules: CurriculumModule[];
  certification?: Certification;
}

interface CurriculumModule {
  moduleId: string;
  title: string;
  documents: string[];
  quiz: Quiz;
  estimatedDuration: number;
}

const curriculum: Record<UserRole, Curriculum> = {
  [UserRole.EXECUTIVE_CHEF]: {
    role: UserRole.EXECUTIVE_CHEF,
    levels: [
      {
        level: 1,
        title: 'Nivel Inicial',
        description: 'Conocimientos básicos de cocina y sistema',
        prerequisites: [],
        modules: [
          {
            moduleId: 'wiki-001',
            title: 'Introducción al Sistema ChefChek',
            documents: ['wiki-doc-001', 'wiki-doc-002'],
            quiz: quiz_001,
            estimatedDuration: 60,
          },
          {
            moduleId: 'wiki-002',
            title: 'Estándares de Calidad',
            documents: ['wiki-doc-003'],
            quiz: quiz_002,
            estimatedDuration: 90,
          },
        ],
      },
      {
        level: 2,
        title: 'Nivel Intermedio',
        description: 'Gestión de cocina y liderazgo',
        prerequisites: ['Nivel 1'],
        modules: [
          {
            moduleId: 'wiki-003',
            title: 'Gestión de Inventarios',
            documents: ['wiki-doc-004', 'wiki-doc-005'],
            quiz: quiz_003,
            estimatedDuration: 120,
          },
        ],
        certification: certification_001,
      },
      {
        level: 3,
        title: 'Nivel Avanzado',
        description: 'Estrategia e innovación',
        prerequisites: ['Nivel 2'],
        modules: [
          {
            moduleId: 'wiki-004',
            title: 'Ingeniería de Menús',
            documents: ['wiki-doc-006'],
            quiz: quiz_004,
            estimatedDuration: 180,
          },
        ],
        certification: certification_002,
      },
    ],
  },
  // ... other roles
};
```

### Evaluación de Conocimiento

```typescript
interface Quiz {
  id: string;
  title: string;
  questions: Question[];
  passingScore: number;
  timeLimit?: number; // minutes
}

interface Question {
  id: string;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'PRACTICAL';
  question: string;
  options?: string[];
  correctAnswer: string | number;
  points: number;
  explanation?: string;
}

interface QuizResult {
  quizId: string;
  userId: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  answers: Answer[];
  completedAt: Date;
}

async function submitQuiz(
  quizId: string,
  userId: string,
  answers: Answer[]
): Promise<QuizResult> {
  const quiz = await this.quizRepository.findOne({ where: { id: quizId } });
  
  let score = 0;
  const detailedAnswers: Answer[] = [];

  for (const answer of answers) {
    const question = quiz.questions.find((q) => q.id === answer.questionId);
    if (!question) continue;

    const isCorrect = this.checkAnswer(question, answer);
    if (isCorrect) {
      score += question.points;
    }

    detailedAnswers.push({
      ...answer,
      isCorrect,
      explanation: question.explanation,
    });
  }

  const maxScore = quiz.questions.reduce((sum, q) => sum + q.points, 0);
  const percentage = (score / maxScore) * 100;
  const passed = percentage >= quiz.passingScore;

  const result = this.quizResultRepository.create({
    id: uuidv4(),
    quizId,
    userId,
    score,
    maxScore,
    percentage,
    passed,
    answers: detailedAnswers,
    completedAt: new Date(),
  });

  await this.quizResultRepository.save(result);

  // Update user's learning progress
  await this.updateLearningProgress(userId, quizId, passed);

  // Provide feedback
  if (passed) {
    await notifyUser(userId, {
      type: 'quiz_passed',
      message: `¡Felicidades! Has aprobado el quiz "${quiz.title}"`,
      score: percentage,
    });
  } else {
    await notifyUser(userId, {
      type: 'quiz_failed',
      message: `El quiz "${quiz.title}" requiere revisión`,
      score: percentage,
      passingScore: quiz.passingScore,
    });
  }

  return result;
}
```

## Lecciones Aprendidas

### Captura de Lecciones

```typescript
interface LessonLearned {
  id: string;
  title: string;
  category: 'OPERATIONAL' | 'FINANCIAL' | 'QUALITY' | 'SAFETY' | 'CUSTOMER';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  description: string;
  rootCause: string;
  impact: string;
  actionTaken: string;
  preventiveAction: string;
  relatedDocuments: string[];
  userId: string;
  tenantId: string;
  createdAt: Date;
}

async function createLessonLearned(
  dto: CreateLessonLearnedDto,
  userId: string
): Promise<LessonLearned> {
  const lesson = this.lessonLearnedRepository.create({
    id: uuidv4(),
    ...dto,
    userId,
    createdAt: new Date(),
  });

  await this.lessonLearnedRepository.save(lesson);

  // Auto-tag related documents
  if (dto.relatedDocuments && dto.relatedDocuments.length > 0) {
    for (const docId of dto.relatedDocuments) {
      await this.addTagToDocument(docId, 'lección_aprendida');
    }
  }

  // Notify relevant users based on category and severity
  if (lesson.severity === 'CRITICAL' || lesson.severity === 'WARNING') {
    await this.notifyCriticalLesson(lesson);
  }

  return lesson;
}
```

### Análisis de Lecciones

```typescript
interface LessonAnalysis {
  category: string;
  totalLessons: number;
  criticalLessons: number;
  commonRootCauses: Record<string, number>;
  trends: LessonTrend[];
  actionableInsights: string[];
}

async function analyzeLessons(tenantId: string, period: TimePeriod): Promise<LessonAnalysis> {
  const dateRange = getDateRange(period);
  const lessons = await this.lessonLearnedRepository.find({
    where: {
      tenantId,
      createdAt: Between(dateRange.startDate, dateRange.endDate),
    },
  });

  const criticalLessons = lessons.filter((l) => l.severity === 'CRITICAL');

  // Analyze common root causes
  const rootCauseCounts: Record<string, number> = {};
  lessons.forEach((lesson) => {
    rootCauseCounts[lesson.rootCause] = (rootCauseCounts[lesson.rootCause] || 0) + 1;
  });

  // Generate actionable insights
  const insights = this.generateInsights(rootCauseCounts, criticalLessons);

  return {
    category: 'ALL',
    totalLessons: lessons.length,
    criticalLessons: criticalLessons.length,
    commonRootCauses: rootCauseCounts,
    trends: [],
    actionableInsights: insights,
  };
}
```

## Mejores Prácticas

### Documentación de Mejores Prácticas

```typescript
interface BestPractice {
  id: string;
  title: string;
  category: string;
  description: string;
  benefits: string[];
  implementation: string;
  metrics: string[];
  relatedDocuments: string[];
  rating: number;
  approvedBy: string;
  tenantId: string;
  createdAt: Date;
}

async function createBestPractice(
  dto: CreateBestPracticeDto,
  userId: string
): Promise<BestPractice> {
  const practice = this.bestPracticeRepository.create({
    id: uuidv4(),
    ...dto,
    rating: 0,
    createdAt: new Date(),
  });

  await this.bestPracticeRepository.save(practice);

  // Submit for approval
  await this.submitForApproval(practice.id, userId);

  return practice;
}
```

### Rating de Mejores Prácticas

```typescript
async function rateBestPractice(
  practiceId: string,
  rating: number,
  userId: string
): Promise<void> {
  const practice = await this.bestPracticeRepository.findOne({
    where: { id: practiceId },
  });

  if (!practice) {
    throw new NotFoundException('Best practice not found');
  }

  const ratingRecord = this.ratingRepository.create({
    id: uuidv4(),
    practiceId,
    userId,
    rating,
    ratedAt: new Date(),
  });

  await this.ratingRepository.save(ratingRecord);

  // Update practice's overall rating
  const ratings = await this.ratingRepository.find({
    where: { practiceId },
  });

  const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
  practice.rating = averageRating;

  await this.bestPracticeRepository.save(practice);
}
```

## Gestión de Conocimiento Tácito

### Conversión a Conocimiento Explícito

```typescript
interface TacitKnowledgeCapture {
  id: string;
  sourceType: 'INTERVIEW' | 'OBSERVATION' | 'FEEDBACK' | 'METRICS';
  sourceId: string;
  knowledge: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'CAPTURED' | 'PROCESSING' | 'DOCUMENTED' | 'REJECTED';
  assignedTo?: string;
  createdAt: Date;
  processedAt?: Date;
}

async function captureTacitKnowledge(
  dto: CreateTacitKnowledgeDto,
  userId: string
): Promise<TacitKnowledgeCapture> {
  const capture = this.tacitKnowledgeRepository.create({
    id: uuidv4(),
    ...dto,
    status: 'CAPTURED',
    createdAt: new Date(),
  });

  await this.tacitKnowledgeRepository.save(capture);

  // Notify knowledge manager
  await this.notifyKnowledgeManager(capture);

  return capture;
}

async function processTacitKnowledge(captureId: string, userId: string): Promise<WikiDocumentDto> {
  const capture = await this.tacitKnowledgeRepository.findOne({
    where: { id: captureId },
  });

  if (!capture) {
    throw new NotFoundException('Knowledge capture not found');
  }

  capture.status = 'PROCESSING';
  capture.assignedTo = userId;
  await this.tacitKnowledgeRepository.save(capture);

  // Analyze and structure the knowledge
  const structuredKnowledge = await this.analyzeKnowledge(capture.knowledge);

  // Create wiki document
  const document = await this.createDocument(
    {
      title: this.generateTitle(capture.knowledge),
      content: structuredKnowledge.content,
      category: structuredKnowledge.category,
      tags: structuredKnowledge.tags,
      tenantId: capture.tenantId,
    },
    userId
  );

  capture.status = 'DOCUMENTED';
  capture.processedAt = new Date();
  await this.tacitKnowledgeRepository.save(capture);

  return document;
}
```

### Análisis Automatizado de Conocimiento

```typescript
interface KnowledgeAnalysis {
  content: string;
  category: string;
  tags: string[];
  summary: string;
  relatedDocuments: string[];
  recommendedActions: string[];
}

async function analyzeKnowledge(knowledge: string): Promise<KnowledgeAnalysis> {
  // Use AI/NLP to categorize and structure knowledge
  const category = await this.categorizeKnowledge(knowledge);
  const tags = await this.extractTags(knowledge);
  const summary = await this.generateSummary(knowledge);
  const relatedDocuments = await this.findRelatedDocuments(knowledge);
  const recommendedActions = await this.generateActions(knowledge, category);

  return {
    content: this.formatAsMarkdown(knowledge, summary),
    category,
    tags,
    summary,
    relatedDocuments,
    recommendedActions,
  };
}

async function categorizeKnowledge(knowledge: string): Promise<string> {
  const categoryKeywords: Record<string, string[]> = {
    [WikiCategory.RECIPE_PREPARATION]: ['receta', 'cocinar', 'preparar', 'ingrediente', 'técnica'],
    [WikiCategory.HYGIENE_SAFETY]: ['limpieza', 'higiene', 'seguridad', 'alimento', 'temperatura'],
    [WikiCategory.EQUIPMENT_MAINTENANCE]: ['equipo', 'mantenimiento', 'limpiar', 'reparar', 'calibrar'],
    [WikiCategory.STANDARDS]: ['estándar', 'calidad', 'presentación', 'porción', 'temperatura'],
    [WikiCategory.EMERGENCY_PROCEDURES]: ['emergencia', 'incendio', 'lesión', 'fallo', 'protocolo'],
  };

  let bestMatch = WikiCategory.STANDARDS;
  let maxMatches = 0;

  const lowerKnowledge = knowledge.toLowerCase();

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    const matches = keywords.filter((keyword) => lowerKnowledge.includes(keyword)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestMatch = category;
    }
  }

  return bestMatch;
}
```

## API Reference

### Crear Lección Aprendida

```http
POST /api/v1/wiki/lessons
Authorization: Bearer {token}

{
  "title": "Mejorar control de porciones",
  "category": "QUALITY",
  "severity": "WARNING",
  "description": "Se observa variación en porciones de pasta",
  "rootCause": "Falta de herramienta de medición estandar",
  "impact": "Aumento de coste de alimentos en 5%",
  "actionTaken": "Implementar control visual de porciones",
  "preventiveAction": "Comprar herramientas de medición digitales",
  "relatedDocuments": ["wiki-doc-001"],
  "tenantId": "uuid-tenant-id",
  "userId": "uuid-user-id"
}

Response 201:
{
  "id": "uuid",
  "title": "Mejorar control de porciones",
  "category": "QUALITY",
  "severity": "WARNING",
  "description": "...",
  "rootCause": "...",
  "impact": "...",
  "actionTaken": "...",
  "preventiveAction": "...",
  "relatedDocuments": ["wiki-doc-001"],
  "userId": "uuid-user-id",
  "tenantId": "uuid-tenant-id",
  "createdAt": "2026-05-31T15:00:00Z"
}
```

### Analizar Lecciones

```http
GET /api/v1/wiki/lessons/analysis?period={period}
Authorization: Bearer {token}

Response 200:
{
  "category": "ALL",
  "totalLessons": 15,
  "criticalLessons": 3,
  "commonRootCauses": {
    "Falta de capacitación": 5,
    "Equipo desactualizado": 3,
    "Proceso no documentado": 4
  },
  "trends": [],
  "actionableInsights": [
    "Implementar programa de formación continua",
    "Actualizar calendario de mantenimiento",
    "Documentar procedimientos críticos"
  ]
}
```

## Checklist de Implementación

### Captura de Conocimiento ✅
- [x] Fuentes identificadas
- [x] Métodos de captura
- [x] Validación de conocimiento
- [x] Conversión a documentos

### Organización ✅
- [x] Categorización funcional
- [x] Etiquetado inteligente
- [x] Indexación automática
- [x] Enlazado de documentos

### Transferencia ✅
- [x] Onboarding de personal
- [x] Currículum de formación
- [x] Evaluación de conocimiento
- [x] Certificación

### Lecciones Aprendidas ✅
- [x] Captura de lecciones
- [x] Análisis de patrones
- [x] Acciones preventivas
- [x] Notificaciones automáticas

### Mejores Prácticas ✅
- [x] Documentación de prácticas
- [x] Sistema de rating
- [x] Aprobación de prácticas
- [x] Difusión a equipo

### Conocimiento Tácito ✅
- [x] Captura desde múltiples fuentes
- [x] Análisis automatizado
- [x] Conversión a explícito
- [x] Generación de documentos

---

**Versión:** 1.0.0
**Última actualización:** 2026-05-31
**Estado:** ✅ Implementado
**Sprint:** 15 - Wiki de Procedimientos