import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateDepartmentDto } from './dto/createDepartment.dto';
import { PrismaService } from '@common/services/prisma.service';
import { RequestUser } from '@common/interfaces/request.interface';
import { Department, UserType } from '@prisma/client';
import {
  CreateDepartmentResponse,
  GetDepartmentsResponse,
  UpdateDepartmentResponse,
} from '@common/interfaces/department/department.interface';
import { UpdateDepartmentDto } from './dto/updateDepartment.dto';

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  async createDepartment(
    user: RequestUser,
    body: CreateDepartmentDto,
  ): Promise<CreateDepartmentResponse> {
    const { organizationId, userId } = user;
    const { departmentName, description } = body;

    const organization = await this.prisma.organizationMember.findFirst({
      where: {
        userId: userId,
        organizationId: organizationId,
        organization: {
          deleted: false,
        },
      },
      select: {
        userType: true,
        organization: {
          select: {
            departmentCreationLimit: true,
            departments: true,
          },
        },
      },
    });

    if (!organization) {
      throw new BadRequestException('ORGANIZATION_NOT_FOUND');
    }

    if (organization.userType === UserType.WORKER) {
      throw new BadRequestException('WORKER_NOT_ALLOWED');
    }

    if (
      organization?.organization?.departments?.length >=
      organization?.organization?.departmentCreationLimit
    ) {
      throw new BadRequestException('DEPARTMENT_LIMIT_REACHED');
    }

    const isDepartmentNameUnique = await this.prisma.department.findFirst({
      where: {
        name: {
          equals: departmentName,
          mode: 'insensitive',
        },
        organizationId: organizationId,
      },
    });

    if (isDepartmentNameUnique) {
      throw new BadRequestException('DEPARTMENT_NAME_NOT_UNIQUE');
    }

    const department = await this.prisma.department.create({
      data: {
        name: departmentName,
        description: description,
        organizationId: organizationId,
        createdBy: userId,
      },
    });

    return {
      departmentId: department.id,
      departmentName: department.name,
      departmentDescription: department.description,
    };
  }

  async getDepartments(user: RequestUser): Promise<GetDepartmentsResponse> {
    const { organizationId, userId } = user;

    const departments = await this.prisma.department.findMany({
      where: {
        organizationId: organizationId,
        deleted: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        description: true,
        organizationId: true,
        _count: {
          select: {
            leads: {
              where: {
                deleted: false,
              },
            },
          },
        },
      },
    });

    const totalCount = await this.prisma.department.count({
      where: {
        organizationId: organizationId,
      },
    });

    return {
      departments,
    };
  }

  async updateDepartment(
    user: RequestUser,
    body: UpdateDepartmentDto,
  ): Promise<UpdateDepartmentResponse> {
    const { organizationId, userId } = user;
    const { departmentId, departmentName, description } = body;

    // Check if department exists
    const department = await this.prisma.department.findUnique({
      where: {
        id: departmentId,
        organizationId,
      },
    });

    if (!department) {
      throw new NotFoundException('DEPARTMENT_NOT_FOUND');
    }

    // Check if user has permission (must be owner or admin)
    const userMembership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: userId,
        userType: { in: [UserType.OWNER, UserType.MANAGER] },
      },
    });

    if (!userMembership) {
      throw new BadRequestException('WORKER_NOT_ALLOWED');
    }

    if (departmentName && departmentName !== department.name) {
      const existingDepartment = await this.prisma.department.findFirst({
        where: {
          name: {
            equals: departmentName,
            mode: 'insensitive',
          },
          organizationId: organizationId,
          id: { not: departmentId },
        },
      });
      if (existingDepartment) {
        throw new BadRequestException('DEPARTMENT_NAME_NOT_UNIQUE');
      }
    }

    const updatedDepartment = await this.prisma.department.update({
      where: {
        id: departmentId,
        organizationId,
      },
      data: {
        name: departmentName ?? department.name,
        description: description ?? department.description,
      },
    });

    return {
      departmentId: updatedDepartment.id,
      departmentName: updatedDepartment.name,
      departmentDescription: updatedDepartment.description,
    };
  }
}
