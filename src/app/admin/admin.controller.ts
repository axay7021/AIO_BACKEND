import {
  Body,
  Controller,
  Get,
  Post,
  Put,
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
import { Platform } from 'src/common/constants/prisma.constant';
import { AuthGuard } from 'src/guard/auth/auth.guard';
import { MulterConfig } from 'src/config/multer.config';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubscriptionGuard } from 'src/guard/auth/subscription.guard';
import { EditProfileDto } from './dto/editProfile.dto';
import { RefreshTokenDto } from './dto/refreshToken.dto';

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

}
