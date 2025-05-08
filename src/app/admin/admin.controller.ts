import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ECoreReqAdmin,
  ECoreReqHeader,
  ECoreReqUser,
  ECoreRes,
  RequestUser,
} from 'src/common/interfaces/request.interface';
import { ResponseService } from 'src/common/services/response.service';
import { CreateAdminDto } from './dto/signup.dto';
import { IPBlockingGuard } from 'src/guard/common/ip-blocking.guard';
import { EmailBlockingGuard } from 'src/guard/nonAuth/email-blocking.guard';
import { AdminService } from './admin.service';
import { HttpStatus } from '@common/constants/httpStatus.constant';
import { CloudinaryService } from '@common/services/clodinary.service';
import { VerifyOtpDto } from './dto/otpVerify.dto';
import { ResendOtpDto } from './dto/resendOtp.dto';
import { SecurityTokenGuard } from 'src/guard/auth/security-token.guard';
import { CompleteProfileDto } from './dto/completeProfile.dto';
import { OrganizationRegisterDto } from './dto/registerOrganization.dto';
import { ForgotPasswordDto } from './dto/forgotPassword.dto';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import { PurchasePlanDto } from './dto/purchasePlan.dto';
import { LoginDto } from './dto/login.dto';
import { Platform } from 'src/common/constants/prisma.constant';
import { GoogleSigninDto } from './dto/googleSignin.dto';
import { AuthGuard } from 'src/guard/auth/auth.guard';
import { EditOrganizationDto } from './dto/editOrganization.dto';
import { MulterConfig } from 'src/config/multer.config';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubscriptionGuard } from 'src/guard/auth/subscription.guard';
import { EditProfileDto } from './dto/editProfile.dto';
import { VerifySubdomainTokenDto } from './dto/subdomainTokenVerify.dto';
import { RefreshTokenDto } from './dto/refreshToken.dto';
import { OrganizationNameCheckDto } from './dto/organizationNameCheck.dto';
import { SubdomainCheckDto } from './dto/subdomainCheck.dto';

@Controller()
export class adminController {
  constructor(
    private readonly responseService: ResponseService,
    private readonly adminService: AdminService,
    private readonly cloudinaryService: CloudinaryService
  ) {}

  // signup  admin
  @Post('auth/create-admin')
  @UseGuards(IPBlockingGuard, EmailBlockingGuard)
  async createAdmin(
    @Req() req: ECoreReqAdmin,
    @Res() res: ECoreRes,
    @Body() body: CreateAdminDto
  ): Promise<ECoreRes> {
    const user = await this.adminService.createAdmin(req, body);
    return this.responseService.success(req, res, 'ADMIN_CREATE_SUCCESS', user, HttpStatus.CREATED);
  }

  @Post('/auth/verify-otp')
  @UseGuards(IPBlockingGuard, EmailBlockingGuard)
  async verifyOtp(
    @Req() req: ECoreReqHeader,
    @Res() res: ECoreRes,
    @Body() body: VerifyOtpDto
  ): Promise<ECoreRes> {
    const user = await this.adminService.verifyOtp(req, body);
    const { token, _statusCode } = user;
    return this.responseService.success(
      req,
      res,
      'OTP_VERIFIED_SUCCESSFULLY',
      { token },
      _statusCode
    );
  }

  @Post('/auth/resend-otp')
  @UseGuards(IPBlockingGuard, EmailBlockingGuard)
  async resendOtp(
    @Req() req: ECoreReqHeader,
    @Res() res: ECoreRes,
    @Body() body: ResendOtpDto
  ): Promise<ECoreRes> {
    await this.adminService.resendOtp(req, body);
    return this.responseService.success(
      req,
      res,
      'OTP_RESENT_SUCCESSFULLY',
      {},
      HttpStatus.SUCCESS
    );
  }

  @Get('auth/verify-token')
  @UseGuards(SecurityTokenGuard)
  async verifyToken(@Req() req: ECoreReqHeader, @Res() res: ECoreRes): Promise<ECoreRes> {
    const userId = req.userId as string;
    await this.adminService.verifyToken(userId);
    return this.responseService.success(req, res, 'TOKEN_VERIFIED', {}, HttpStatus.SUCCESS);
  }

  @Post('auth/complete-profile')
  @UseGuards(SecurityTokenGuard)
  async completeProfile(
    @Req() req: ECoreReqHeader,
    @Res() res: ECoreRes,
    @Body() body: CompleteProfileDto
  ): Promise<ECoreRes> {
    const userId = req.userId as string;
    await this.adminService.completeProfile(userId, body);
    return this.responseService.success(
      req,
      res,
      'PROFILE_UPDATED_SUCCESSFULLY',
      {},
      HttpStatus.SUCCESS
    );
  }

  @Post('auth/register-organization')
  @UseGuards(SecurityTokenGuard)
  async registerOrganization(
    @Req() req: ECoreReqHeader,
    @Res() res: ECoreRes,
    @Body() body: OrganizationRegisterDto
  ): Promise<ECoreRes> {
    const userId = req.userId as string;
    const data = await this.adminService.registerOrganization(userId, body);
    return this.responseService.success(
      req,
      res,
      'ORGANIZATION_REGISTERED_SUCCESSFULLY',
      data,
      HttpStatus.SUCCESS
    );
  }

  @Post('auth/forgot-password')
  @UseGuards(IPBlockingGuard, EmailBlockingGuard)
  async forgotPassword(
    @Req() req: ECoreReqHeader,
    @Res() res: ECoreRes,
    @Body() body: ForgotPasswordDto
  ): Promise<ECoreRes> {
    const data = await this.adminService.forgotPassword(req, body);
    return this.responseService.success(
      req,
      res,
      'FORGOT_PASSWORD_OTP_SENT_SUCCESSFULLY',
      data,
      HttpStatus.SUCCESS
    );
  }

  @Post('auth/reset-password')
  @UseGuards(SecurityTokenGuard)
  async resetPassword(
    @Req() req: ECoreReqHeader,
    @Res() res: ECoreRes,
    @Body() body: ResetPasswordDto
  ): Promise<ECoreRes> {
    const userId = req.userId as string;
    await this.adminService.resetPassword(userId, body);
    return this.responseService.success(
      req,
      res,
      'PASSWORD_RESET_SUCCESSFULLY',
      {},
      HttpStatus.SUCCESS
    );
  }

  @Get('auth/get-plan-detail')
  @UseGuards(SecurityTokenGuard)
  async getPlanDetail(@Req() req: ECoreReqHeader, @Res() res: ECoreRes): Promise<ECoreRes> {
    const data = await this.adminService.getPlanDetail();
    return this.responseService.success(req, res, 'PLAN_DETAIL', data, HttpStatus.SUCCESS);
  }

  @Post('auth/purchase-plan')
  @UseGuards(SecurityTokenGuard)
  async purchasePlan(
    @Req() req: ECoreReqHeader,
    @Res() res: ECoreRes,
    @Body() body: PurchasePlanDto
  ): Promise<ECoreRes> {
    const userId = req.userId as string;
    const data = await this.adminService.purchasePlan(userId, body);
    return this.responseService.success(
      req,
      res,
      'PLAN_PURCHASED_SUCCESSFULLY',
      data,
      HttpStatus.SUCCESS
    );
  }

  @Post('auth/crm/login')
  @UseGuards(IPBlockingGuard, EmailBlockingGuard)
  async crmLogin(
    @Req() req: ECoreReqHeader,
    @Res() res: ECoreRes,
    @Body() body: LoginDto
  ): Promise<ECoreRes> {
    const data = await this.adminService.crmLogin(req, body, Platform.WEBSITE);
    return this.responseService.success(req, res, 'LOGIN_SUCCESSFULLY', data, HttpStatus.SUCCESS);
  }

  @Post('auth/app/login')
  @UseGuards(IPBlockingGuard, EmailBlockingGuard)
  async appLogin(
    @Req() req: ECoreReqHeader,
    @Res() res: ECoreRes,
    @Body() body: LoginDto
  ): Promise<ECoreRes> {
    const data = await this.adminService.appExtensionLogin(req, body, Platform.APP);
    return this.responseService.success(req, res, 'LOGIN_SUCCESSFULLY', data, HttpStatus.SUCCESS);
  }

  @Post('auth/extension/login')
  @UseGuards(IPBlockingGuard, EmailBlockingGuard)
  async extensionLogin(
    @Req() req: ECoreReqHeader,
    @Res() res: ECoreRes,
    @Body() body: LoginDto
  ): Promise<ECoreRes> {
    const data = await this.adminService.appExtensionLogin(req, body, Platform.EXTENSION);
    return this.responseService.success(req, res, 'LOGIN_SUCCESSFULLY', data, HttpStatus.SUCCESS);
  }

  @Post('auth/google/app/login')
  @UseGuards(IPBlockingGuard, EmailBlockingGuard)
  async googleLoginApp(
    @Req() req: ECoreReqHeader,
    @Res() res: ECoreRes,
    @Body() body: GoogleSigninDto
  ): Promise<ECoreRes> {
    const user = await this.adminService.googleLoginApp(req, body);
    return this.responseService.success(req, res, 'LOGIN_SUCCESSFULLY', user, HttpStatus.SUCCESS);
  }

  @Post('auth/google/crm/login')
  @UseGuards(IPBlockingGuard, EmailBlockingGuard)
  async googleLoginCrm(
    @Req() req: ECoreReqHeader,
    @Res() res: ECoreRes,
    @Body() body: GoogleSigninDto
  ): Promise<ECoreRes> {
    const user = await this.adminService.googleLoginCrm(req, body);
    const { _statuscode } = user;
    return this.responseService.success(req, res, 'LOGIN_SUCCESSFULLY', user, _statuscode);
  }

  @Post('auth/crm/verify-subdomain-token')
  async verifySubdomainToken(
    @Req() req: ECoreReqHeader,
    @Res() res: ECoreRes,
    @Body() body: VerifySubdomainTokenDto
  ): Promise<ECoreRes> {
    const data = await this.adminService.verifySubdomainToken(body.token);
    return this.responseService.success(
      req,
      res,
      'SUBDOMAIN_TOKEN_VERIFIED',
      data,
      HttpStatus.SUCCESS
    );
  }

  @Put('edit-organization')
  @UseGuards(AuthGuard, SubscriptionGuard)
  @UseInterceptors(FileInterceptor('orgImage', MulterConfig))
  async editOrganization(
    @Req() req: ECoreReqUser,
    @Res() res: ECoreRes,
    @Body() body: EditOrganizationDto,
    @UploadedFile() orgImage: Express.Multer.File
  ): Promise<ECoreRes> {
    const user = req?.user as unknown as RequestUser;
    const data = await this.adminService.editOrganization(user, body, orgImage);
    return this.responseService.success(
      req,
      res,
      'ORGANIZATION_EDITED_SUCCESSFULLY',
      data,
      HttpStatus.SUCCESS
    );
  }

  @Get('get-profile-detail')
  @UseGuards(AuthGuard, SubscriptionGuard)
  async getProfileDetail(@Req() req: ECoreReqUser, @Res() res: ECoreRes): Promise<ECoreRes> {
    const user = req?.user as unknown as RequestUser;
    const data = await this.adminService.getProfileDetail(user);
    return this.responseService.success(req, res, 'PROFILE_DETAIL', data, HttpStatus.SUCCESS);
  }

  @Put('edit-profile-detail')
  @UseGuards(AuthGuard, SubscriptionGuard)
  @UseInterceptors(FileInterceptor('profileImage', MulterConfig))
  async editProfile(
    @Req() req: ECoreReqUser,
    @Res() res: ECoreRes,
    @Body() body: EditProfileDto,
    @UploadedFile() profileImage: Express.Multer.File
  ): Promise<ECoreRes> {
    const user = req?.user as unknown as RequestUser;
    console.log({ body, profileImage });
    const data = await this.adminService.editProfile(user, body, profileImage);
    return this.responseService.success(
      req,
      res,
      'PROFILE_UPDATED_SUCCESSFULLY',
      data,
      HttpStatus.SUCCESS
    );
  }

  @Get('get-organization-detail')
  @UseGuards(AuthGuard, SubscriptionGuard)
  async getOrganizationDetail(@Req() req: ECoreReqUser, @Res() res: ECoreRes): Promise<ECoreRes> {
    const user = req?.user as unknown as RequestUser;
    const data = await this.adminService.getOrganizationDetail(user);
    return this.responseService.success(req, res, 'ORGANIZATION_DETAIL', data, HttpStatus.SUCCESS);
  }

  @Post('auth/crm/refresh-token')
  async refreshTokenCrm(
    @Req() req: ECoreReqHeader,
    @Res() res: ECoreRes,
    @Body() body: RefreshTokenDto
  ): Promise<ECoreRes> {
    const data = await this.adminService.refreshToken(req, body, Platform.WEBSITE);
    return this.responseService.success(req, res, 'TOKEN_REFRESHED', data, HttpStatus.SUCCESS);
  }

  @Post('auth/app/refresh-token')
  async refreshTokenApp(
    @Req() req: ECoreReqHeader,
    @Res() res: ECoreRes,
    @Body() body: RefreshTokenDto
  ): Promise<ECoreRes> {
    const data = await this.adminService.refreshToken(req, body, Platform.APP);
    return this.responseService.success(req, res, 'TOKEN_REFRESHED', data, HttpStatus.SUCCESS);
  }

  @Post('auth/extension/refresh-token')
  async refreshTokenExtension(
    @Req() req: ECoreReqHeader,
    @Res() res: ECoreRes,
    @Body() body: RefreshTokenDto
  ): Promise<ECoreRes> {
    const data = await this.adminService.refreshToken(req, body, Platform.EXTENSION);
    return this.responseService.success(req, res, 'TOKEN_REFRESHED', data, HttpStatus.SUCCESS);
  }

  @Get('organization-name-check')
  async organizationNameCheck(
    @Req() req: ECoreReqUser,
    @Res() res: ECoreRes,
    @Query() query: OrganizationNameCheckDto
  ): Promise<ECoreRes> {
    const user = req?.user as unknown as RequestUser;
    const data = await this.adminService.organizationNameCheck(user, query);
    return this.responseService.success(
      req,
      res,
      data.isAvailable ? 'ORGANIZATION_NAME_AVAILABLE' : 'ORGANIZATION_NAME_UNAVAILABLE',
      data,
      data.isAvailable ? HttpStatus.SUCCESS : HttpStatus.BAD_REQUEST
    );
  }

  @Get('subdomain-name-check')
  async subdomainCheck(
    @Req() req: ECoreReqUser,
    @Res() res: ECoreRes,
    @Query() query: SubdomainCheckDto
  ): Promise<ECoreRes> {
    const user = req?.user as unknown as RequestUser;
    const data = await this.adminService.subdomainCheck(user, query);
    return this.responseService.success(
      req,
      res,
      data.isAvailable ? 'SUBDOMAIN_AVAILABLE' : 'SUBDOMAIN_UNAVAILABLE',
      data,
      data.isAvailable ? HttpStatus.SUCCESS : HttpStatus.BAD_REQUEST
    );
  }
}
