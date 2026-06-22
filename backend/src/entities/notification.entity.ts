import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";

@Entity()
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  type: string;

  @Column()
  title: string;

  @Column("text")
  message: string;

  @Column({ nullable: true })
  taskId: string;

  @Column({ nullable: true })
  sprintId: string;

  @Column()
  recipientId: string;

  @Column({ default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ default: "MEDIUM" })
  priority: string;

  @Column("json", { nullable: true })
  metadata: Record<string, any>;
}
