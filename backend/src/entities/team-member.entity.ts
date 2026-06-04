import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";

@Entity()
export class TeamMember {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column()
  role: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: "float", default: 40 })
  availableHours: number;

  @Column({ default: 0 })
  assignedTasks: number;

  @Column({ default: 0 })
  completedTasks: number;

  @Column()
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;
}
