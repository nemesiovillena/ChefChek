import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
export class Task {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column("text")
  description: string;

  @Column()
  sprintId: string;

  @Column({ default: "TODO" })
  status: string;

  @Column({ default: "MEDIUM" })
  priority: string;

  @Column({ type: "date", nullable: true })
  dueDate: Date;

  @Column("json", { default: [] })
  tags: string[];

  @Column({ type: "float", nullable: true })
  estimatedHours: number;

  @Column({ nullable: true })
  assignedTo: string;

  @Column("json", { default: [] })
  dependsOn: string[];

  @Column({ nullable: true })
  notes: string;

  @Column()
  tenantId: string;

  @Column()
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
