# Team Coordination

## Resumen

Sistema de coordinación de equipo para desarrollo colaborativo. Incluye gestión de miembros del equipo, asignación de roles, seguimiento de disponibilidad, métricas de desempeño y comunicación efectiva.

---

## Roles y Responsabilidades

### Definición de Roles

```typescript
enum TeamRole {
  EXECUTIVE_CHEF = 'EXECUTIVE_CHEF',
  SOUS_CHEF = 'SOUS_CHEF',
  LINE_COOK = 'LINE_COOK',
  PREP_COOK = 'PREP_COOK',
  STEWARD = 'STEWARD',
  DISHWASHER = 'DISHWASHER',
  MANAGER = 'MANAGER',
  OWNER = 'OWNER',
  SENIOR_DEV = 'SENIOR_DEV',
  JUNIOR_DEV = 'JUNIOR_DEV',
  TEAM_LEAD = 'TEAM_LEAD',
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  QA_ENGINEER = 'QA_ENGINEER',
  DEVOPS_ENGINEER = 'DEVOPS_ENGINEER',
}

interface RolePermissions {
  role: TeamRole;
  canCreateSprint: boolean;
  canDeleteSprint: boolean;
  canAssignTasks: boolean;
  canAssignDevelopers: boolean;
  canApproveTasks: boolean;
  canViewAllSprints: boolean;
  canViewTeamMetrics: boolean;
  canManageTeam: boolean;
}
```

### Matriz de Permisos

```typescript
const rolePermissions: RolePermissions[] = [
  {
    role: TeamRole.PROJECT_MANAGER,
    canCreateSprint: true,
    canDeleteSprint: true,
    canAssignTasks: true,
    canAssignDevelopers: true,
    canApproveTasks: true,
    canViewAllSprints: true,
    canViewTeamMetrics: true,
    canManageTeam: true,
  },
  {
    role: TeamRole.TEAM_LEAD,
    canCreateSprint: true,
    canDeleteSprint: false,
    canAssignTasks: true,
    canAssignDevelopers: false,
    canApproveTasks: true,
    canViewAllSprints: true,
    canViewTeamMetrics: true,
    canManageTeam: false,
  },
  {
    role: TeamRole.SENIOR_DEV,
    canCreateSprint: false,
    canDeleteSprint: false,
    canAssignTasks: true,
    canAssignDevelopers: false,
    canApproveTasks: true,
    canViewAllSprints: true,
    canViewTeamMetrics: false,
    canManageTeam: false,
  },
  {
    role: TeamRole.JUNIOR_DEV,
    canCreateSprint: false,
    canDeleteSprint: false,
    canAssignTasks: false,
    canAssignDevelopers: false,
    canApproveTasks: false,
    canViewAllSprints: true,
    canViewTeamMetrics: false,
    canManageTeam: false,
  },
  {
    role: TeamRole.QA_ENGINEER,
    canCreateSprint: false,
    canDeleteSprint: false,
    canAssignTasks: false,
    canAssignDevelopers: false,
    canApproveTasks: true,
    canViewAllSprints: true,
    canViewTeamMetrics: false,
    canManageTeam: false,
  },
];
```

### Validación de Permisos

```typescript
class PermissionValidator {
  hasPermission(userId: string, permission: keyof RolePermissions): boolean {
    const member = this.teamMemberRepository.findOne({
      where: { id: userId },
    });

    if (!member) return false;

    const rolePermission = rolePermissions.find(p => p.role === member.role);

    if (!rolePermission) return false;

    return rolePermission[permission];
  }

  validateAction(userId: string, action: string): {
    allowed: boolean;
    reason?: string;
  } {
    const member = this.teamMemberRepository.findOne({
      where: { id: userId },
    });

    if (!member) {
      return { allowed: false, reason: 'Usuario no encontrado' };
    }

    if (!member.isActive) {
      return { allowed: false, reason: 'Usuario inactivo' };
    }

    const rolePermission = rolePermissions.find(p => p.role === member.role);

    if (!rolePermission) {
      return { allowed: false, reason: 'Rol no reconocido' };
    }

    switch (action) {
      case 'CREATE_SPRINT':
        return {
          allowed: rolePermission.canCreateSprint,
          reason: rolePermission.canCreateSprint ? undefined : 'No tiene permiso para crear sprints',
        };

      case 'DELETE_SPRINT':
        return {
          allowed: rolePermission.canDeleteSprint,
          reason: rolePermission.canDeleteSprint ? undefined : 'No tiene permiso para eliminar sprints',
        };

      case 'ASSIGN_TASK':
        return {
          allowed: rolePermission.canAssignTasks,
          reason: rolePermission.canAssignTasks ? undefined : 'No tiene permiso para asignar tareas',
        };

      case 'ASSIGN_DEVELOPER':
        return {
          allowed: rolePermission.canAssignDevelopers,
          reason: rolePermission.canAssignDevelopers ? undefined : 'No tiene permiso para asignar desarrolladores',
        };

      case 'APPROVE_TASK':
        return {
          allowed: rolePermission.canApproveTasks,
          reason: rolePermission.canApproveTasks ? undefined : 'No tiene permiso para aprobar tareas',
        };

      case 'VIEW_TEAM_METRICS':
        return {
          allowed: rolePermission.canViewTeamMetrics,
          reason: rolePermission.canViewTeamMetrics ? undefined : 'No tiene permiso para ver métricas de equipo',
        };

      case 'MANAGE_TEAM':
        return {
          allowed: rolePermission.canManageTeam,
          reason: rolePermission.canManageTeam ? undefined : 'No tiene permiso para gestionar el equipo',
        };

      default:
        return { allowed: false, reason: 'Acción no reconocida' };
    }
  }
}
```

---

## Gestión de Disponibilidad

### Sistema de Horas Disponibles

```typescript
interface Availability {
  memberId: string;
  memberName: string;
  availableHours: number;
  assignedHours: number;
  remainingHours: number;
  utilizationPercentage: number;
  status: 'AVAILABLE' | 'BUSY' | 'OVERLOADED';
  scheduledOffTime?: Date[];
}

class AvailabilityManager {
  // Actualizar disponibilidad
  async updateAvailability(
    memberId: string,
    availableHours: number,
    tenantId: string,
  ): Promise<void> {
    await this.teamMemberRepository.update(
      { id: memberId, tenantId },
      { availableHours },
    );
  }

  // Calcular disponibilidad actual
  async calculateAvailability(memberId: string): Promise<Availability> {
    const member = await this.teamMemberRepository.findOne({
      where: { id: memberId },
    });

    const tasks = await this.taskRepository.find({
      where: { assignedTo: memberId },
    });

    const assignedHours = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const remainingHours = member.availableHours - assignedHours;
    const utilizationPercentage = (assignedHours / member.availableHours) * 100;

    let status: 'AVAILABLE' | 'BUSY' | 'OVERLOADED';
    if (utilizationPercentage < 80) {
      status = 'AVAILABLE';
    } else if (utilizationPercentage < 100) {
      status = 'BUSY';
    } else {
      status = 'OVERLOADED';
    }

    return {
      memberId,
      memberName: member.name,
      availableHours: member.availableHours,
      assignedHours,
      remainingHours,
      utilizationPercentage,
      status,
    };
  }

  // Obtener miembros disponibles para asignación
  async getAvailableMembers(tenantId: string): Promise<TeamMember[]> {
    const members = await this.teamMemberRepository.find({
      where: { tenantId, isActive: true },
    });

    const availabilities = await Promise.all(
      members.map(async member => ({
        member,
        availability: await this.calculateAvailability(member.id),
      })),
    );

    // Filtrar solo miembros con disponibilidad
    return availabilities
      .filter(a => a.availability.remainingHours > 0)
      .sort((a, b) => a.availability.remainingHours - b.availability.remainingHours)
      .map(a => a.member);
  }

  // Detectar overload del equipo
  async detectTeamOverload(sprintId: string): Promise<{
    overloaded: Array<{ memberId: string; memberName: string; overloadHours: number }>;
    totalOverload: number;
  }> {
    const tasks = await this.taskRepository.find({
      where: { sprintId },
    });

    const workloads = new Map<string, number>();

    for (const task of tasks) {
      if (task.assignedTo) {
        const current = workloads.get(task.assignedTo) || 0;
        workloads.set(task.assignedTo, current + (task.estimatedHours || 0));
      }
    }

    const overloaded: Array<{ memberId: string; memberName: string; overloadHours: number }> = [];
    let totalOverload = 0;

    for (const [memberId, assignedHours] of workloads.entries()) {
      const member = await this.teamMemberRepository.findOne({
        where: { id: memberId },
      });

      if (assignedHours > member.availableHours) {
        const overloadHours = assignedHours - member.availableHours;
        overloaded.push({
          memberId,
          memberName: member.name,
          overloadHours,
        });
        totalOverload += overloadHours;
      }
    }

    return { overloaded, totalOverload };
  }
}
```

### Programación de Ausencias

```typescript
interface OffTime {
  id: string;
  memberId: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  approvedBy: string;
  createdAt: Date;
}

class OffTimeManager {
  // Solicitar tiempo fuera
  async requestOffTime(
    memberId: string,
    startDate: Date,
    endDate: Date,
    reason: string,
  ): Promise<OffTime> {
    const request = this.offTimeRepository.create({
      id: uuidv4(),
      memberId,
      startDate,
      endDate,
      reason,
      approvedBy: null,
      createdAt: new Date(),
    });

    await this.offTimeRepository.save(request);

    // Notificar manager
    await this.notifyOffTimeRequest(request);

    return request;
  }

  // Aprobar tiempo fuera
  async approveOffTime(offTimeId: string, approvedBy: string): Promise<void> {
    const offTime = await this.offTimeRepository.findOne({
      where: { id: offTimeId },
    });

    offTime.approvedBy = approvedBy;
    await this.offTimeRepository.save(offTime);

    // Recalcular disponibilidad del miembro
    await this.recalculateAvailabilityAfterOffTime(offTime.memberId, offTime);

    // Notificar miembro
    await this.notifyOffTimeApproved(offTime);
  }

  // Calcular impacto en sprint
  async calculateOffTimeImpact(offTime: OffTime, sprintId: string): Promise<{
    affectedTasks: Task[];
    totalHours: number;
    recommendation: string;
  }> {
    const tasks = await this.taskRepository.find({
      where: { assignedTo: offTime.memberId, sprintId },
    });

    const affectedTasks = tasks.filter(task => {
      if (!task.dueDate) return false;

      const taskDue = new Date(task.dueDate);
      const offStart = new Date(offTime.startDate);
      const offEnd = new Date(offTime.endDate);

      // Tarea vence durante el tiempo fuera
      return taskDue >= offStart && taskDue <= offEnd;
    });

    const totalHours = affectedTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);

    let recommendation: string;
    if (affectedTasks.length === 0) {
      recommendation = 'No afecta el sprint actual';
    } else if (totalHours <= 8) {
      recommendation = 'Impacto leve: considerar reasignar tareas afectadas';
    } else if (totalHours <= 20) {
      recommendation = 'Impacto moderado: reasignar tareas o ajustar fechas';
    } else {
      recommendation = 'Impacto alto: reconsiderar fechas o retrasar sprint';
    }

    return {
      affectedTasks,
      totalHours,
      recommendation,
    };
  }
}
```

---

## Métricas de Desempeño

### Métricas Individuales

```typescript
interface MemberPerformance {
  memberId: string;
  memberName: string;
  role: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  tasks: {
    assigned: number;
    completed: number;
    inProgress: number;
    blocked: number;
  };
  completionRate: number;
  avgTaskDuration: number;
  estimationAccuracy: number;
  onTimeDeliveryRate: number;
  codeReviewScore?: number;
}

class PerformanceTracker {
  // Calcular desempeño del miembro
  async calculateMemberPerformance(
    memberId: string,
    period: TimePeriod,
  ): Promise<MemberPerformance> {
    const dateRange = getDateRange(period);

    const tasks = await this.taskRepository.find({
      where: {
        assignedTo: memberId,
        createdAt: Between(dateRange.startDate, dateRange.endDate),
      },
    });

    const completed = tasks.filter(t => t.status === TaskStatus.COMPLETED);
    const inProgress = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS);
    const blocked = tasks.filter(t => t.status === TaskStatus.BLOCKED);

    const completionRate = tasks.length > 0
      ? (completed.length / tasks.length) * 100
      : 0;

    // Calcular duración promedio de tareas
    const avgTaskDuration = this.calculateAvgTaskDuration(completed);

    // Calcular precisión de estimación
    const estimationAccuracy = await this.calculateEstimationAccuracy(completed);

    // Calcular tasa de entrega a tiempo
    const onTimeDeliveryRate = this.calculateOnTimeDeliveryRate(completed);

    return {
      memberId,
      memberName: (await this.teamMemberRepository.findOne({ where: { id: memberId } }))?.name || 'Unknown',
      role: (await this.teamMemberRepository.findOne({ where: { id: memberId } }))?.role || 'Unknown',
      period: dateRange,
      tasks: {
        assigned: tasks.length,
        completed: completed.length,
        inProgress: inProgress.length,
        blocked: blocked.length,
      },
      completionRate,
      avgTaskDuration,
      estimationAccuracy,
      onTimeDeliveryRate,
    };
  }

  private calculateAvgTaskDuration(tasks: Task[]): number {
    if (tasks.length === 0) return 0;

    const durations = tasks.map(task => {
      const created = new Date(task.createdAt).getTime();
      const updated = new Date(task.updatedAt).getTime();
      return (updated - created) / (1000 * 60 * 60); // en horas
    });

    return durations.reduce((sum, d) => sum + d, 0) / durations.length;
  }

  private async calculateEstimationAccuracy(tasks: Task[]): Promise<number> {
    if (tasks.length === 0) return 100;

    let totalAccuracy = 0;

    for (const task of tasks) {
      if (!task.estimatedHours) continue;

      const actualHours = (new Date(task.updatedAt).getTime() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60);
      const accuracy = Math.min((task.estimatedHours / actualHours) * 100, 100);

      totalAccuracy += accuracy;
    }

    return totalAccuracy / tasks.length;
  }

  private calculateOnTimeDeliveryRate(tasks: Task[]): number {
    if (tasks.length === 0) return 100;

    const onTimeTasks = tasks.filter(task => {
      if (!task.dueDate) return true; // Sin fecha límite = a tiempo

      const completed = new Date(task.updatedAt);
      const due = new Date(task.dueDate);

      return completed <= due;
    });

    return (onTimeTasks.length / tasks.length) * 100;
  }
}
```

### Métricas de Equipo

```typescript
interface TeamMetrics {
  sprintId: string;
  sprintName: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  overall: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    avgCycleTime: number;
    velocity: number;
  };
  byMember: MemberPerformance[];
  teamHealth: {
    score: number;
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    factors: {
      overload: boolean;
      lowPerformance: boolean;
      highBlocked: boolean;
      poorEstimation: boolean;
    };
  };
  recommendations: string[];
}

class TeamMetricsCalculator {
  // Calcular métricas de equipo
  async calculateTeamMetrics(sprintId: string): Promise<TeamMetrics> {
    const sprint = await this.sprintRepository.findOne({
      where: { id: sprintId },
    });

    const tasks = await this.taskRepository.find({
      where: { sprintId },
    });

    const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED);
    const completionRate = tasks.length > 0
      ? (completedTasks.length / tasks.length) * 100
      : 0;

    const avgCycleTime = this.calculateAvgCycleTime(completedTasks);
    const velocity = completedTasks.length; // Story points en el futuro

    // Métricas por miembro
    const uniqueAssignees = [...new Set(tasks.map(t => t.assignedTo).filter(Boolean))];
    const byMember = await Promise.all(
      uniqueAssignees.map(async memberId => {
        return this.performanceTracker.calculateMemberPerformance(
          memberId,
          { startDate: sprint.startDate, endDate: sprint.endDate },
        );
      }),
    );

    // Calcular salud del equipo
    const teamHealth = this.calculateTeamHealth(byMember, tasks);

    // Generar recomendaciones
    const recommendations = this.generateRecommendations(teamHealth, byMember);

    return {
      sprintId,
      sprintName: sprint.name,
      period: {
        startDate: sprint.startDate,
        endDate: sprint.endDate,
      },
      overall: {
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        completionRate,
        avgCycleTime,
        velocity,
      },
      byMember,
      teamHealth,
      recommendations,
    };
  }

  private calculateAvgCycleTime(tasks: Task[]): number {
    if (tasks.length === 0) return 0;

    const cycleTimes = tasks.map(task => {
      const created = new Date(task.createdAt).getTime();
      const completed = new Date(task.updatedAt).getTime();
      return (completed - created) / (1000 * 60 * 60); // en horas
    });

    return cycleTimes.reduce((sum, t) => sum + t, 0) / cycleTimes.length;
  }

  private calculateTeamHealth(members: MemberPerformance[], tasks: Task[]): {
    score: number;
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    factors: {
      overload: boolean;
      lowPerformance: boolean;
      highBlocked: boolean;
      poorEstimation: boolean;
    };
  } {
    let score = 100;
    const factors = {
      overload: false,
      lowPerformance: false,
      highBlocked: false,
      poorEstimation: false,
    };

    // Factor 1: Sobrecarga de equipo
    const overloadedMembers = members.filter(m => {
      const workload = this.calculateWorkload(m.memberId);
      return workload.workloadPercentage > 100;
    });

    if (overloadedMembers.length > 0) {
      factors.overload = true;
      score -= 20 * overloadedMembers.length;
    }

    // Factor 2: Bajo desempeño
    const lowPerfMembers = members.filter(m => m.completionRate < 50);
    if (lowPerfMembers.length > 0) {
      factors.lowPerformance = true;
      score -= 15 * lowPerfMembers.length;
    }

    // Factor 3: Tareas bloqueadas
    const blockedRatio = tasks.filter(t => t.status === TaskStatus.BLOCKED).length / tasks.length;
    if (blockedRatio > 0.3) {
      factors.highBlocked = true;
      score -= 20;
    }

    // Factor 4: Pobre estimación
    const avgEstimationAccuracy = members.reduce((sum, m) => sum + m.estimationAccuracy, 0) / members.length;
    if (avgEstimationAccuracy < 70) {
      factors.poorEstimation = true;
      score -= 15;
    }

    score = Math.max(0, Math.min(100, score));

    let status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    if (score >= 80) {
      status = 'HEALTHY';
    } else if (score >= 50) {
      status = 'WARNING';
    } else {
      status = 'CRITICAL';
    }

    return { score, status, factors };
  }

  private generateRecommendations(teamHealth: TeamMetrics['teamHealth'], members: MemberPerformance[]): string[] {
    const recommendations: string[] = [];

    if (teamHealth.factors.overload) {
      recommendations.push('Considerar redistribuir carga de trabajo o añadir miembros al equipo');
    }

    if (teamHealth.factors.lowPerformance) {
      recommendations.push('Programar sesiones de mentoring o capacitación para miembros con bajo desempeño');
    }

    if (teamHealth.factors.highBlocked) {
      recommendations.push('Priorizar resolución de tareas bloqueadas para evitar retrasos');
    }

    if (teamHealth.factors.poorEstimation) {
      recommendations.push('Mejorar proceso de estimación con planning poker o técnicas similares');
    }

    if (recommendations.length === 0) {
      recommendations.push('Equipo funcionando bien. Continuar con prácticas actuales');
    }

    return recommendations;
  }
}
```

---

## Comunicación y Notificaciones

### Canales de Comunicación

```typescript
interface CommunicationChannel {
  type: 'NOTIFICATION' | 'EMAIL' | 'SLACK' | 'TEAMS' | 'GITHUB' | 'JIRA';
  enabled: boolean;
  config?: Record<string, any>;
}

class CommunicationManager {
  // Enviar notificación multi-canal
  async sendNotification(
    recipientId: string,
    title: string,
    message: string,
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    channels?: CommunicationChannel[],
  ): Promise<void> {
    const member = await this.teamMemberRepository.findOne({
      where: { id: recipientId },
    });

    // Guardar en sistema de notificaciones
    await this.createNotification(
      title,
      message,
      recipientId,
      undefined,
      undefined,
      priority,
    );

    // Enviar por canales configurados
    const enabledChannels = channels || member.communicationChannels;

    for (const channel of enabledChannels) {
      if (!channel.enabled) continue;

      switch (channel.type) {
        case 'EMAIL':
          await this.sendEmail(member.email, title, message, priority);
          break;

        case 'SLACK':
          await this.sendSlack(channel.config?.webhookUrl, title, message, priority);
          break;

        case 'TEAMS':
          await this.sendTeams(channel.config?.webhookUrl, title, message, priority);
          break;

        case 'GITHUB':
          await this.createGitHubIssue(member.githubUsername, title, message);
          break;

        case 'JIRA':
          await this.createJiraTask(member.jiraAccountId, title, message, priority);
          break;
      }
    }
  }

  // Configurar canales de comunicación del miembro
  async configureCommunicationChannels(
    memberId: string,
    channels: CommunicationChannel[],
  ): Promise<void> {
    await this.teamMemberRepository.update(
      { id: memberId },
      { communicationChannels: channels },
    );
  }
}
```

### Resumen de Comunicación

```typescript
interface CommunicationSummary {
  memberId: string;
  memberName: string;
  period: TimePeriod;
  notifications: {
    received: number;
    read: number;
    unread: number;
    byPriority: {
      LOW: number;
      MEDIUM: number;
      HIGH: number;
      URGENT: number;
    };
  };
  responseTime: {
    avg: number;
    median: number;
    max: number;
  };
}

class CommunicationAnalyzer {
  // Analizar comunicación del miembro
  async analyzeCommunication(
    memberId: string,
    period: TimePeriod,
  ): Promise<CommunicationSummary> {
    const dateRange = getDateRange(period);

    const notifications = await this.notificationRepository.find({
      where: {
        recipientId: memberId,
        createdAt: Between(dateRange.startDate, dateRange.endDate),
      },
    });

    const received = notifications.length;
    const read = notifications.filter(n => n.read).length;
    const unread = received - read;

    const byPriority = {
      LOW: notifications.filter(n => n.priority === 'LOW').length,
      MEDIUM: notifications.filter(n => n.priority === 'MEDIUM').length,
      HIGH: notifications.filter(n => n.priority === 'HIGH').length,
      URGENT: notifications.filter(n => n.priority === 'URGENT').length,
    };

    // Calcular tiempo de respuesta (primera lectura - creación)
    const responseTimes = notifications
      .filter(n => n.read && n.firstReadAt)
      .map(n => {
        const created = new Date(n.createdAt).getTime();
        const read = new Date(n.firstReadAt!).getTime();
        return (read - created) / (1000 * 60); // en minutos
      });

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
      : 0;

    const medianResponseTime = this.calculateMedian(responseTimes);
    const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

    return {
      memberId,
      memberName: (await this.teamMemberRepository.findOne({ where: { id: memberId } }))?.name || 'Unknown',
      period: dateRange,
      notifications: {
        received,
        read,
        unread,
        byPriority,
      },
      responseTime: {
        avg: avgResponseTime,
        median: medianResponseTime,
        max: maxResponseTime,
      },
    };
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}
```

---

## API Reference

### Agregar Miembro al Equipo

```http
POST /api/v1/sprint-tracker/team
Authorization: Bearer {token}

{
  "name": "Developer Name",
  "email": "developer@example.com",
  "role": "SENIOR_DEV"
}

Response 201:
{
  "id": "uuid-member-id",
  "name": "Developer Name",
  "email": "developer@example.com",
  "role": "SENIOR_DEV",
  "isActive": true,
  "availableHours": 40,
  "assignedTasks": 0,
  "completedTasks": 0
}
```

### Actualizar Disponibilidad

```http
PUT /api/v1/sprint-tracker/team/:memberId/availability
Authorization: Bearer {token}

{
  "availableHours": 32
}

Response 204: No Content
```

### Generar Reporte de Progreso del Equipo

```http
GET /api/v1/sprint-tracker/reports/progress
Authorization: Bearer {token}

Response 200:
{
  "sprintId": "all",
  "sprintName": "Reporte de Progreso General",
  "generatedAt": "2026-05-31T16:00:00Z",
  "overview": {
    "totalSprints": 16,
    "completedSprints": 15,
    "inProgressSprints": 1,
    "notStartedSprints": 0
  },
  "sprints": [
    {
      "sprintId": "uuid-16",
      "sprintName": "Sprint 16: Roadmap/Sprint Tracker Interno",
      "status": "IN_PROGRESS",
      "progress": 75.0,
      "teamMembers": ["member-1", "member-2"],
      "blockedIssues": [],
      "estimatedCompletion": "2026-06-05T00:00:00Z"
    }
  ]
}
```

---

## Checklist de Implementación

### Roles y Permisos ✅
- [x] 13 roles definidos
- [x] Matriz de permisos por rol
- [x] Validación de permisos
- [x] Control de acceso basado en roles

### Disponibilidad ✅
- [x] Sistema de horas disponibles
- [x] Cálculo de utilización
- [x] Detección de overload
- [x] Programación de ausencias
- [x] Análisis de impacto de ausencias

### Métricas de Desempeño ✅
- [x] Métricas individuales
- [x] Métricas de equipo
- [x] Cálculo de salud del equipo
- [x] Generación de recomendaciones
- [x] Análisis de comunicación

### Comunicación ✅
- [x] Sistema de notificaciones
- [x] Canales multi-canal
- [x] Priorización de notificaciones
- [x] Análisis de tiempo de respuesta
- [x] Configuración de canales por miembro

---

**Versión:** 1.0.0
**Última actualización:** 2026-05-31
**Estado:** ✅ Implementado
**Sprint:** 16 - Roadmap/Sprint Tracker Interno