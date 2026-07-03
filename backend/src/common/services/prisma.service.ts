import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const modelsWithSoftDelete = [
  "user",
  "product",
  "recipe",
  "sprint",
  "task",
  "warehouse",
  "supplier",
  "category",
  "albaran",
];

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private _extendedClient: any;

  constructor() {
    super();

    this._extendedClient = this.$extends({
      query: {
        $allModels: {
          async findMany({ model, args, query }) {
            const modelName = model.toLowerCase();
            if (modelsWithSoftDelete.includes(modelName)) {
              args.where = { ...args.where, deletedAt: null };
            }
            return query(args);
          },
          async findFirst({ model, args, query }) {
            const modelName = model.toLowerCase();
            if (modelsWithSoftDelete.includes(modelName)) {
              args.where = { ...args.where, deletedAt: null };
            }
            return query(args);
          },
          async findUnique({ model, args, query }) {
            const modelName = model.toLowerCase();
            if (modelsWithSoftDelete.includes(modelName)) {
              args.where = { ...args.where, deletedAt: null };
            }
            return query(args);
          },
          async count({ model, args, query }) {
            const modelName = model.toLowerCase();
            if (modelsWithSoftDelete.includes(modelName)) {
              args.where = { ...args.where, deletedAt: null };
            }
            return query(args);
          },
          async delete({ model, args }) {
            const modelName = model.toLowerCase();
            if (modelsWithSoftDelete.includes(modelName)) {
              return (this as any)[modelName].update({
                where: args.where,
                data: { deletedAt: new Date() },
              });
            }
            // Comportamiento por defecto para otros modelos sin soft-delete
            return (this as any)[modelName].delete(args);
          },
          async deleteMany({ model, args }) {
            const modelName = model.toLowerCase();
            if (modelsWithSoftDelete.includes(modelName)) {
              return (this as any)[modelName].updateMany({
                where: args.where,
                data: { deletedAt: new Date() },
              });
            }
            return (this as any)[modelName].deleteMany(args);
          },
        },
      },
    });

    // Devolver un Proxy para redirigir las llamadas a _extendedClient transparentemente
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (prop in target) {
          if (
            prop === "onModuleInit" ||
            prop === "onModuleDestroy" ||
            prop === "$connect" ||
            prop === "$disconnect" ||
            prop === "_extendedClient"
          ) {
            return Reflect.get(target, prop, receiver);
          }
        }
        return Reflect.get(target._extendedClient, prop);
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
