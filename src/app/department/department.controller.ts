import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { DepartmentService } from './department.service';
import { ResponseService } from '@common/services/response.service';
import {
  ECoreReq,
  ECoreReqUser,
  ECoreRes,
  RequestUser,
} from '@common/interfaces/request.interface';
import { CreateDepartmentDto } from './dto/createDepartment.dto';
import { AuthGuard } from 'src/guard/auth/auth.guard';
import { SubscriptionGuard } from 'src/guard/auth/subscription.guard';
import { RequireFeature } from '@common/decorator/require-feature.decorator';
import { FeatureNames } from '@common/enums/feature-names.enum';
import { UpdateDepartmentDto } from './dto/updateDepartment.dto';

@Controller('department')
@RequireFeature(FeatureNames.MANAGE_DEPARTMENTS)
export class DepartmentController {
  constructor(
    private readonly departmentService: DepartmentService,
    private readonly responseService: ResponseService,
  ) {}

  @Post('create-department')
  @UseGuards(AuthGuard, SubscriptionGuard)
  async createDepartment(
    @Req() req: ECoreReqUser,
    @Res() res: ECoreRes,
    @Body() body: CreateDepartmentDto,
  ): Promise<ECoreRes> {
    const user = req.user as unknown as RequestUser;
    const department = await this.departmentService.createDepartment(user, body);
    return this.responseService.success(
      req,
      res,
      'DEPARTMENT_CREATED_SUCCESSFULLY',
      department,
      HttpStatus.CREATED,
    );
  }

  @Get('get-departments')
  @UseGuards(AuthGuard, SubscriptionGuard)
  async getDepartments(@Req() req: ECoreReqUser, @Res() res: ECoreRes): Promise<ECoreRes> {
    const user = req.user as unknown as RequestUser;
    const departments = await this.departmentService.getDepartments(user);
    return this.responseService.success(
      req,
      res,
      'DEPARTMENTS_FETCHED_SUCCESSFULLY',
      departments,
      HttpStatus.OK,
    );
  }

  @Put('update-department')
  @UseGuards(AuthGuard, SubscriptionGuard)
  async updateDepartment(
    @Req() req: ECoreReqUser,
    @Res() res: ECoreRes,
    @Body() body: UpdateDepartmentDto,
  ): Promise<ECoreRes> {
    const user = req.user as unknown as RequestUser;
    const department = await this.departmentService.updateDepartment(user, body);
    return this.responseService.success(
      req,
      res,
      'DEPARTMENT_UPDATED_SUCCESSFULLY',
      department,
      HttpStatus.OK,
    );
  }
}
