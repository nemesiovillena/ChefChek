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
          // Arrow functions: capturan el `this` del constructor (cliente base con
          // delegates de modelo). Con method shorthand, `this` sería el objeto
          // $allModels y `this[model]` undefined → TypeError en todo delete.
          delete: async ({ model, args, query }) => {
            if (modelsWithSoftDelete.includes(model.toLowerCase())) {
              // El delegate del cliente usa camelCase (Category → category)
              const delegate = (this as any)[
                model.charAt(0).toLowerCase() + model.slice(1)
              ];
              return delegate.update({
                where: args.where,
                data: { deletedAt: new Date() },
              });
            }
            // Comportamiento por defecto para otros modelos sin soft-delete
            return query(args);
          },
          deleteMany: async ({ model, args, query }) => {
            if (modelsWithSoftDelete.includes(model.toLowerCase())) {
              const delegate = (this as any)[
                model.charAt(0).toLowerCase() + model.slice(1)
              ];
              return delegate.updateMany({
                where: args.where,
                data: { deletedAt: new Date() },
              });
            }
            return query(args);
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
