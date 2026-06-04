import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
export class Sprint {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: "DEVELOPMENT" })
  type: string;

  @Column({ default: "NOT_STARTED" })
  status: string;

  @Column({ type: "date" })
  startDate: Date;

  @Column({ type: "date" })
  endDate: Date;

  @Column()
  tenantId: string;

  @Column({ nullable: true })
  projectId: string;

  @Column("json", { nullable: true })
  objectives: string[];

  @Column({ nullable: true })
  teamMembers: string[];

  @Column({ nullable: true })
  notes: string;

  @Column()
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: 0 })
  progress: number;

  @Column({ default: 0 })
  totalTasks: number;

  @Column({ default: 0 })
  completedTasks: number;
}
