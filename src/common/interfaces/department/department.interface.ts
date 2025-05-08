export interface CreateDepartmentResponse {
  departmentId: string;
  departmentName: string;
  departmentDescription: string;
}

interface Department {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  _count: {
    leads: number;
  };
}

export interface GetDepartmentsResponse {
  departments: Department[];
}

export interface UpdateDepartmentResponse {
  departmentId: string;
  departmentName: string;
  departmentDescription: string;
}
