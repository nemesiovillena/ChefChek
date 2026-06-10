import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";

@Injectable()
export class SprintService {
  constructor(private readonly prisma: PrismaService) {}

  // CRUD de Sprints
  async createSprint(tenantId: string, userId: string, dto: any) {
    const {
      name,
      description,
      type,
      startDate,
      endDate,
      projectId,
      objectives,
      teamMembers,
      notes,
    } = dto;

    const sprint = await this.prisma.sprint.create({
      data: {
        tenantId,
        name,
        description,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        projectId,
        objectives,
        teamMembers,
        notes,
        createdBy: userId,
        progress: 0,
        totalTasks: 0,
        completedTasks: 0,
        status: "NOT_STARTED",
      },
    });

    return {
      success: true,
      data: sprint,
      message: "Sprint created successfully",
    };
  }

  async getAllSprints(tenantId: string) {
    const sprints = await this.prisma.sprint.findMany({
      where: { tenantId },
      include: {
        tasks: {
          orderBy: { dueDate: "asc" },
        },
        teamMember: true,
      },
      orderBy: { startDate: "desc" },
    });

    return {
      success: true,
      data: sprints,
      message: "Sprints retrieved successfully",
    };
  }

  async getSprintById(tenantId: string, sprintId: string) {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, tenantId },
      include: {
        tasks: {
          include: {
            assignedMember: true,
          },
          orderBy: { priority: "desc", dueDate: "asc" },
        },
        teamMember: true,
      },
    });

    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    return {
      success: true,
      data: sprint,
      message: "Sprint retrieved successfully",
    };
  }

  async updateSprint(tenantId: string, sprintId: string, dto: any) {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, tenantId },
    });

    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    const updated = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: {
        ...dto,
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      data: updated,
      message: "Sprint updated successfully",
    };
  }

  async deleteSprint(tenantId: string, sprintId: string) {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, tenantId },
    });

    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    // Check if sprint has tasks
    const tasksCount = await this.prisma.task.count({
      where: { sprintId },
    });

    if (tasksCount > 0) {
      throw new BadRequestException(
        "Cannot delete sprint with tasks. Delete tasks first or cancel sprint instead.",
      );
    }

    await this.prisma.sprint.delete({
      where: { id: sprintId },
    });

    return {
      success: true,
      message: "Sprint deleted successfully",
    };
  }

  async startSprint(tenantId: string, sprintId: string, userId: string) {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, tenantId },
    });

    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    if (sprint.status !== "NOT_STARTED") {
      throw new BadRequestException(
        "Sprint is already in progress or completed",
      );
    }

    const updated = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: { status: "IN_PROGRESS", startDate: new Date() },
    });

    return {
      success: true,
      data: updated,
      message: "Sprint started successfully",
    };
  }

  async completeSprint(tenantId: string, sprintId: string) {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, tenantId },
    });

    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    if (sprint.status !== "IN_PROGRESS") {
      throw new BadRequestException(
        "Only IN_PROGRESS sprints can be completed",
      );
    }

    // Check if all tasks are completed
    const pendingTasks = await this.prisma.task.count({
      where: {
        sprintId,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    });

    if (pendingTasks > 0) {
      throw new BadRequestException(
        "Cannot complete sprint with pending tasks",
      );
    }

    const updated = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: {
        status: "COMPLETED",
        endDate: new Date(),
        progress: 100,
        completedTasks: sprint.totalTasks,
      },
    });

    return {
      success: true,
      data: updated,
      message: "Sprint completed successfully",
    };
  }

  async cancelSprint(tenantId: string, sprintId: string, userId: string) {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, tenantId },
    });

    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    if (sprint.status === "COMPLETED") {
      throw new BadRequestException("Cannot cancel completed sprint");
    }

    const updated = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: {
        status: "CANCELLED",
        endDate: new Date(),
      },
    });

    return {
      success: true,
      data: updated,
      message: "Sprint cancelled successfully",
    };
  }

  async getSprintProgress(tenantId: string, sprintId: string) {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, tenantId },
    });

    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    const tasks = await this.prisma.task.findMany({
      where: { sprintId },
    });

    const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
    const inProgressTasks = tasks.filter(
      (t) => t.status === "IN_PROGRESS",
    ).length;
    const blockedTasks = tasks.filter((t) => t.status === "BLOCKED").length;
    const totalTasks = tasks.length;

    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return {
      success: true,
      data: {
        sprintId,
        sprintName: sprint.name,
        status: sprint.status,
        progress,
        totalTasks,
        completedTasks,
        inProgressTasks,
        blockedTasks,
        remainingTasks: totalTasks - completedTasks,
      },
      message: "Sprint progress retrieved successfully",
    };
  }

  async getSprintAnalytics(tenantId: string, sprintId: string) {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, tenantId },
      include: {
        tasks: true,
        teamMember: true,
      },
    });

    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    const tasks = sprint.tasks;
    const teamMembers = sprint.teamMember;

    // Analytics de tareas
    const tasksByStatus = tasks.reduce(
      (acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const tasksByPriority = tasks.reduce(
      (acc, task) => {
        acc[task.priority] = (acc[task.priority] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalEstimatedHours = tasks.reduce(
      (sum, task) => sum + (task.estimatedHours || 0),
      0,
    );
    const totalActualHours = tasks.reduce(
      (sum, task) => sum + (task.estimatedHours || 0) * 0.8,
      0,
    ); // Estimado 80% eficiencia

    // Velocity
    const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
    const sprintDuration = Math.max(
      1,
      Math.ceil(
        (new Date(sprint.endDate).getTime() -
          new Date(sprint.startDate).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    const velocity = completedTasks / sprintDuration;

    return {
      success: true,
      data: {
        sprint: {
          id: sprint.id,
          name: sprint.name,
          status: sprint.status,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          progress: sprint.progress,
        },
        tasks: {
          total: tasks.length,
          byStatus: tasksByStatus,
          byPriority: tasksByPriority,
          totalEstimatedHours,
          totalActualHours,
          efficiency:
            totalEstimatedHours > 0
              ? (totalActualHours / totalEstimatedHours) * 100
              : 0,
        },
        team: {
          memberCount: teamMembers.length,
          members: teamMembers.map((member) => ({
            id: member.id,
            name: member.name,
            assignedTasks: tasks.filter((t) => t.assignedTo === member.id)
              .length,
            completedTasks: tasks.filter(
              (t) => t.assignedTo === member.id && t.status === "COMPLETED",
            ).length,
          })),
        },
        metrics: {
          velocity,
          averageTasksPerDay: velocity,
          completionRate:
            tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0,
          blockedTaskCount: tasksByStatus["BLOCKED"] || 0,
        },
      },
      message: "Sprint analytics retrieved successfully",
    };
  }
}
