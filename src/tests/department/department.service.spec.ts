import { DepartmentService } from '@app/department/department.service';
import { CreateDepartmentDto } from '@app/department/dto/createDepartment.dto';
import { RequestUser } from '@common/interfaces/request.interface';
import { PrismaService } from '@common/services/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserType } from '@prisma/client';

describe('DepartmentService', () => {
  let departmentService: DepartmentService;
  let prismaService: PrismaService;
  const mockPrismaService = {
    department: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    organizationMember: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [],
      providers: [DepartmentService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    departmentService = module.get<DepartmentService>(DepartmentService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks(); // Reset all mocks after each test
  });

  it('should be defined', () => {
    expect(departmentService).toBeDefined();
  });

  describe('create-department', () => {
    const mockUser = {
      userId: 'user123',
      organizationId: 'org123',
    };

    const createDepartmentDto: CreateDepartmentDto = {
      departmentName: 'HR',
      description: 'Human Resources Department',
    };

    it('should throw if organization is missing', async () => {
      // Arrange
      mockPrismaService.organizationMember.findFirst.mockResolvedValue(null);

      // Act and Assert
      await expect(
        departmentService.createDepartment(mockUser as unknown as RequestUser, createDepartmentDto),
      ).rejects.toThrow(new BadRequestException('ORGANIZATION_NOT_FOUND'));

      expect(prismaService.organizationMember.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockUser.userId,
          organizationId: mockUser.organizationId,
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
    });

    it('should throw if user is a WORKER', () => {
      // Arrange
      mockPrismaService.organizationMember.findFirst.mockResolvedValue({
        userType: UserType.WORKER,
        organization: {},
      });

      // Act and Assert
      expect(
        departmentService.createDepartment(mockUser as unknown as RequestUser, createDepartmentDto),
      ).rejects.toThrow(new BadRequestException('WORKER_NOT_ALLOWED'));
    });

    it('should throw DEPARTMENT_LIMIT_REACHED if department limit is exceeded', () => {
      // Arrange
      mockPrismaService.organizationMember.findFirst.mockResolvedValue({
        userType: UserType.MANAGER,
        organization: {
          departmentCreationLimit: 2,
          departments: [{ id: 1 }, { id: 2 }],
        },
      });
      // Act and Assert
      expect(
        departmentService.createDepartment(mockUser as unknown as RequestUser, createDepartmentDto),
      ).rejects.toThrow(new BadRequestException('DEPARTMENT_LIMIT_REACHED'));
    });

    it('should throw if department name already exists', async () => {
      // Arrange
      mockPrismaService.organizationMember.findFirst.mockResolvedValue({
        userType: UserType.MANAGER,
        organization: {
          departmentCreationLimit: 5,
          departments: [{ id: 1 }],
        },
      });

      mockPrismaService.department.findFirst.mockResolvedValue({ id: 1 });

      await expect(
        departmentService.createDepartment(mockUser as unknown as RequestUser, createDepartmentDto),
      ).rejects.toThrow(new BadRequestException('DEPARTMENT_NAME_NOT_UNIQUE'));
    });

    it('should create and return department successfully', async () => {
      // Arrange
      mockPrismaService.organizationMember.findFirst.mockResolvedValue({
        userType: UserType.MANAGER,
        organization: {
          departmentCreationLimit: 5,
          departments: [{ id: 'uuid' }],
        },
      });

      mockPrismaService.department.findFirst.mockResolvedValue(null);

      const mockDepartment = {
        id: 'uuid',
        name: createDepartmentDto.departmentName,
        description: createDepartmentDto.description,
        organizationId: mockUser.organizationId,
        createdBy: mockUser.userId,
      };

      mockPrismaService.department.create.mockResolvedValue(mockDepartment);

      // Act
      const result = await departmentService.createDepartment(
        mockUser as unknown as RequestUser,
        createDepartmentDto,
      );

      // Assertion
      expect(result).toEqual({
        departmentId: mockDepartment.id,
        departmentName: mockDepartment.name,
        departmentDescription: mockDepartment.description,
      });

      expect(prismaService.department.create).toHaveBeenCalledWith({
        data: {
          name: createDepartmentDto.departmentName,
          description: createDepartmentDto.description,
          organizationId: mockUser.organizationId,
          createdBy: mockUser.userId,
        },
      });
    });

    // end create department tests
  });

  describe('get-departments', () => {
    const mockUser = {
      userId: 'user123',
      organizationId: 'org123',
    };

    const mockDepartments = [
      {
        id: 'uuid',
        name: 'HR',
        description: 'Human Resources Department',
        organizationId: mockUser.organizationId,
        _count: {
          leads: 10,
        },
      },
    ];

    it('should return departments successfully', async () => {
      // Arrange
      mockPrismaService.department.findMany.mockResolvedValue(mockDepartments);
      mockPrismaService.department.count.mockResolvedValue(1);
      // Act
      const result = await departmentService.getDepartments(mockUser as unknown as RequestUser);

      // Assertion
      expect(result).toEqual({
        departments: mockDepartments,
      });
    });
  });

  describe('update-department', () => {
    const mockUser = {
      userId: 'user123',
      organizationId: 'org123',
    };

    const mockDepartment = {
      id: 'uuid',
      name: 'HR',
      description: 'Human Resources Department',
      organizationId: mockUser.organizationId,
    };

    it('should throw if department is not found', async () => {
      // Arrange
      mockPrismaService.department.findUnique.mockResolvedValue(null);

      // Act and Assert
      await expect(
        departmentService.updateDepartment(mockUser as unknown as RequestUser, {
          departmentId: mockDepartment.id,
          departmentName: mockDepartment.name,
          description: mockDepartment.description,
        }),
      ).rejects.toThrow(new NotFoundException('DEPARTMENT_NOT_FOUND'));

      expect(prismaService.department.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockDepartment.id,
          organizationId: mockUser.organizationId,
        },
      });
    });

    it('should throw if user is a WORKER', async () => {
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      // Arrange
      mockPrismaService.organizationMember.findFirst.mockResolvedValue(null);

      // Act and Assert
      await expect(
        departmentService.updateDepartment(mockUser as unknown as RequestUser, {
          departmentId: mockDepartment.id,
          departmentName: mockDepartment.name,
          description: mockDepartment.description,
        }),
      ).rejects.toThrow(new BadRequestException('WORKER_NOT_ALLOWED'));

      expect(prismaService.organizationMember.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: mockUser.organizationId,
          userId: mockUser.userId,
          userType: { in: [UserType.OWNER, UserType.MANAGER] },
        },
      });
    });

    it('should throw if department name is not unique', async () => {
      // Arrange
      mockPrismaService.department.findUnique.mockResolvedValue({
        id: mockDepartment.id,
        name: 'Marketing', // Original name different from what we're trying to update to
        description: mockDepartment.description,
        organizationId: mockUser.organizationId,
      });
      mockPrismaService.organizationMember.findFirst.mockResolvedValue({
        userType: UserType.MANAGER,
        organization: {
          departmentCreationLimit: 5,
          departments: [{ id: 'uuid' }],
        },
      });
      mockPrismaService.department.findFirst.mockResolvedValue({
        id: 'uuid',
        name: 'HR',
        description: 'Human Resources Department',
        organizationId: mockUser.organizationId,
      });
      // Act and Assert
      await expect(
        departmentService.updateDepartment(mockUser as unknown as RequestUser, {
          departmentId: mockDepartment.id,
          departmentName: mockDepartment.name,
          description: mockDepartment.description,
        }),
      ).rejects.toThrow(new BadRequestException('DEPARTMENT_NAME_NOT_UNIQUE'));

      expect(prismaService.department.findFirst).toHaveBeenCalledWith({
        where: {
          name: {
            equals: mockDepartment.name,
            mode: 'insensitive',
          },
          organizationId: mockUser.organizationId,
          id: { not: mockDepartment.id },
        },
      });
    });

    it('should update department successfully', async () => {
      // Arrange
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.organizationMember.findFirst.mockResolvedValue({
        userType: UserType.MANAGER,
        organization: {
          departmentCreationLimit: 5,
          departments: [{ id: 'uuid' }],
        },
      });
      mockPrismaService.department.update.mockResolvedValue({
        id: mockDepartment.id,
        name: mockDepartment.name,
        description: mockDepartment.description,
      });

      // Act
      const result = await departmentService.updateDepartment(mockUser as unknown as RequestUser, {
        departmentId: mockDepartment.id,
        departmentName: mockDepartment.name,
        description: mockDepartment.description,
      });

      // Assertion
      expect(result).toEqual({
        departmentId: mockDepartment.id,
        departmentName: mockDepartment.name,
        departmentDescription: mockDepartment.description,
      });
    });
  });
});
