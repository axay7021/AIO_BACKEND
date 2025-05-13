import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { CreateAdminDto } from './dto/signup.dto';
import { IPBlockingGuard } from 'src/guard/common/ip-blocking.guard';
import { EmailBlockingGuard } from 'src/guard/nonAuth/email-blocking.guard';
import { ECoreReq, ECoreReqAdmin, RequestUser } from 'src/common/interfaces/request.interface';
import { HashingService } from 'src/common/services/hashing.service';
import { generateOTP } from '@common/services/otp.service';
import { EmailService } from '@common/services/email.service';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { TokenUtils } from '@common/services/jwt.service';
import { v4 as uuidv4 } from 'uuid';
import {
  EditProfileResponse,
  ProfileDetailResponse,
  RefreshTokenResponse,
  SignUpResponse,
  VerifyOtpResponse,
} from '@common/interfaces/admin/admin.interface';
import { VerifyOtpDto } from './dto/otpVerify.dto';
import { HttpStatus } from '@common/constants/httpStatus.constant';
import { ResendOtpDto } from './dto/resendOtp.dto';
import { CompleteProfileDto } from './dto/completeProfile.dto';
import { Platform } from '@common/constants/prisma.constant';
import { CLOUDINARY_FOLDERS, CloudinaryService } from '@common/services/clodinary.service';
import { EditProfileDto } from './dto/editProfile.dto';
import { RefreshTokenDto } from './dto/refreshToken.dto';

@Injectable()
export class AdminService {
  private googleClient: OAuth2Client;
  constructor(
    private readonly prisma: PrismaService,
    private readonly ipBlockingGuard: IPBlockingGuard,
    private readonly emailBlockingGuard: EmailBlockingGuard,
    private readonly hashingService: HashingService,
    private readonly emailService: EmailService,
    private readonly jwtService: TokenUtils,
    private readonly cloudinaryService: CloudinaryService,
  ) {
    this.googleClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL,
    );
  }

  /*
   * @description create amin, only root admin has access to this method
   * @param body
   * @param body.email - The email address of the new admin
   * @param body.password - The password for the new admin
   * @returns { email: string; otp: string }
   */
  async createAdmin(req: ECoreReqAdmin, body: CreateAdminDto): Promise<SignUpResponse> {
    // TODO: Uncomment this when the admin is created
    /**
      if (req.admin.isRootAdmin === false) {
        throw new UnauthorizedException('UNAUTHORIZED_ACCESS');
      }
    */

    const email = body.email.trim().toLowerCase();
    // Check if email already exists
    const isEmailExists = await this.prisma.admin.findUnique({
      where: {
        email,
        isDeleted: false,
      },
    });
    if (isEmailExists) {
      throw new HttpException(
        {
          message: 'EMAIL_ALREADY_EXISTS',
          statusCode: 402,
        },
        402,
      );
    }
    // Encrypt password
    const encryptedPassword = await this.hashingService.hashPassword(body.password);
    // Generate OTP
    const otp = generateOTP(6);
    // Create new user
    const { user } = await this.prisma.$transaction(async prisma => {
      const user = await prisma.admin.create({
        data: {
          email: email,
          password: encryptedPassword,
          otp: otp,
          otpExpireTime: new Date(Date.now() + 5 * 60000), // 5 minutes
          nextOtpTime: new Date(Date.now() + 30000), // 30 seconds
          isEmailVerified: false,
          isBlocked: false,
          isDeleted: false,
          isSuper: false,
        },
      });

      return { user };
    });
    // Send OTP to email
    // await this.emailService.sendOtpToMail(email, { otp: otp });
    return {
      email: user.email,
      otp: otp.toString(),
    };
  }

  async verifyOtp(req: ECoreReq, body: VerifyOtpDto): Promise<VerifyOtpResponse> {
    const { email, otp } = body;

    const user = await this.prisma.admin.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        password: true,
        // isPasswordReset: true,
        isEmailVerified: true,
        otp: true,
        otpExpireTime: true,
      },
    });

    if (!user) {
      // Perform IP and Email blocking concurrently
      await Promise.all([
        this.ipBlockingGuard.trackFailedAttempt(req.ip),
        this.emailBlockingGuard.trackFailedAttempt(email),
      ]);

      throw new NotFoundException({
        message: 'INVALID_EMAIL_OR_PASSWORD',
      });
    }

    // Verify OTP
    if (user?.otp !== Number(otp)) {
      // Track failed attempt
      this.ipBlockingGuard.trackFailedAttempt(req.ip);
      this.emailBlockingGuard.trackFailedAttempt(body.email);

      throw new BadRequestException({
        message: 'INVALID_OTP',
        data: { email: body.email },
      });
    }

    // Check if OTP has expired
    if (!user?.otpExpireTime || new Date() > user?.otpExpireTime) {
      throw new BadRequestException({
        message: 'OTP_EXPIRED',
        data: { email: body.email },
      });
    }

    // set email verfied
    await this.prisma.admin.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        otp: null,
        otpExpireTime: null,
        nextOtpTime: null,
      },
    });

    // If this was for password reset, reset the flag after successful verification
    // if (user.isPasswordReset) {
    //   await this.prisma.user.update({
    //     where: { id: user.id },
    //     data: {
    //       isPasswordReset: false,
    //     },
    //   });
    // }

    // Generate token
    const token = await this.jwtService.generateToken(user.id);

    return {
      token,
      _statusCode: HttpStatus.ACCEPTED,
    };
  }

  async resendOtp(req: ECoreReq, body: ResendOtpDto): Promise<boolean> {
    const user = await this.prisma.admin.findUnique({
      where: {
        email: body.email.toLowerCase().trim(),
      },
      select: {
        id: true,
        isEmailVerified: true,
        otp: true,
        otpExpireTime: true,
        nextOtpTime: true,
      },
    });

    if (!user) {
      // Perform IP and Email blocking concurrently
      this.ipBlockingGuard.trackFailedAttempt(req.ip);
      this.emailBlockingGuard.trackFailedAttempt(body.email);

      throw new BadRequestException({
        message: 'INVALID_EMAIL_OR_PASSWORD',
        data: { email: body.email },
      });
    }

    const currentTime = new Date();
    if (user?.nextOtpTime && currentTime < user.nextOtpTime) {
      // Perform IP and Email blocking concurrently
      this.ipBlockingGuard.trackFailedAttempt(req.ip);
      this.emailBlockingGuard.trackFailedAttempt(body.email);
      throw new BadRequestException({
        message: 'OTP_COOLDOWN_TIME',
      });
    }

    // Generate OTP
    const otp = generateOTP(6);

    await this.prisma.admin.update({
      where: { id: user?.id },
      data: {
        otp: otp,
        otpExpireTime: new Date(Date.now() + 5 * 60000), // 5 minutes
        nextOtpTime: new Date(Date.now() + 30000), // 30 seconds
      },
    });

    // Send OTP to email
    await this.emailService.sendOtpToMail(body.email, { otp: otp });
    return true;
  }

  async verifyToken(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'INVALID_EMAIL_OR_PASSWORD',
      });
    }

    if (!user.name || !user.mobile) {
      throw new HttpException(
        {
          message: 'INCOMPLETE_PROFILE',
          data: {
            token: await this.jwtService.generateToken(user.id),
          },
        },
        HttpStatus.ACCEPTED,
      );
    }

    return true;
  }

  async completeProfile(userId: string, body: CompleteProfileDto): Promise<boolean> {
    const user = await this.prisma.admin.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'INVALID_EMAIL_OR_PASSWORD',
      });
    }

    await this.prisma.admin.update({
      where: { id: user?.id },
      data: {
        firstName: body.firstName ?? user.firstName,
        lastName: body.lastName ?? user.lastName,
      },
    });
    return true;
  }

  async getProfileDetail(user: RequestUser): Promise<ProfileDetailResponse> {
    const { userId } = user;

    const userDetails = await this.prisma.admin.findFirst({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        profileImageKey: true,
      },
    });

    if (!userDetails) {
      throw new UnauthorizedException('USER_NOT_FOUND');
    }

    return {
      userId: userDetails.id,
      email: userDetails.email,
      firstName: userDetails.firstName,
      lastName: userDetails.lastName,
      profileImage: userDetails.profileImageUrl,
    };
  }

  async editProfile(
    user: RequestUser,
    body: EditProfileDto,
    profileImage: Express.Multer.File,
  ): Promise<EditProfileResponse> {
    const { firstName, lastName } = body;
    const { userId } = user;

    const userDetails = await this.prisma.admin.findUnique({
      where: { id: userId },
    });

    if (!userDetails) {
      throw new BadRequestException('USER_NOT_FOUND');
    }

    let profileImageKey = userDetails.profileImageKey;
    let profileImageUrl = userDetails.profileImageUrl;

    if (profileImage) {
      const uploadedImage = await this.cloudinaryService.uploadImage(
        profileImage.path,
        CLOUDINARY_FOLDERS.USER_PROFILE,
      );

      if (profileImageKey) {
        await this.cloudinaryService.deleteImage(profileImageKey);
      }

      profileImageKey = uploadedImage.public_id;
      profileImageUrl = uploadedImage.secure_url;
    }

    const updatedProfile = await this.prisma.admin.update({
      where: { id: userId },
      data: {
        firstName: firstName ?? userDetails.firstName,
        lastName: lastName ?? userDetails.lastName,
        profileImageKey: profileImageKey ?? userDetails.profileImageKey,
        profileImageUrl: profileImageUrl ?? userDetails.profileImageUrl,
      },
    });

    return {
      userId: updatedProfile.id,
      firstName: updatedProfile.firstName,
      lastName: updatedProfile.lastName,
      profileImage: updatedProfile.profileImageUrl,
    };
  }

  async refreshToken(
    req: ECoreReq,
    body: RefreshTokenDto,
    platform: Platform,
  ): Promise<RefreshTokenResponse> {
    const { refreshToken } = body;
    const payload = await this.jwtService.verifyRefreshToken(refreshToken, platform);
    const { userId, organizationId, refreshTokenNonce: refreshTokenNonceFromPayload } = payload;

    // Check if user is valid
    const user = await this.prisma.admin.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new BadRequestException('INVALID_USER');
    }

    // Check if platform is valid and dynamically check the corresponding column
    const accessTokenColumn = this.getAccessTokenColumn(platform);
    const platformColumn = this.getPlatformColumn(platform);
    if (!platformColumn) {
      throw new BadRequestException('INVALID_PLATFORM');
    }

    // Check if refresh token nonce is valid
    if (refreshTokenNonceFromPayload !== user[platformColumn]) {
      throw new BadRequestException('INVALID_REFRESH_TOKEN');
    }

    // Generate access token
    let accessTokenExpiry: string;
    let refreshTokenExpiry: string;

    switch (platform) {
      case Platform.WEBSITE:
        accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY_WEBSITE;
        refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY_WEBSITE;
        break;
      case Platform.APP:
        accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY_APP;
        refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY_APP;
        break;
      case Platform.EXTENSION:
        accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY_EXTENSION;
        refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY_EXTENSION;
        break;
      default:
        throw new BadRequestException('INVALID_PLATFORM');
    }

    const accessTokenNonce = uuidv4();
    const refreshTokenNonce = uuidv4();

    const { accessToken } = await this.jwtService.generateTokens(
      {
        id: userId,
        organizationId,
      },
      platform,
      accessTokenExpiry,
      refreshTokenExpiry,
      accessTokenNonce,
      refreshTokenNonce,
    );

    await this.prisma.admin.update({
      where: {
        id: userId,
      },
      data: {
        [accessTokenColumn]: accessTokenNonce,
      },
    });

    return {
      accessToken,
    };
  }

  // Helper method to get the platform-specific column name
  private getPlatformColumn(platform: Platform): string | null {
    switch (platform) {
      case Platform.WEBSITE:
        return 'refreshTokenCRMId';
      case Platform.APP:
        return 'refreshTokenAPPId';
      case Platform.EXTENSION:
        return 'refreshTokenEXTENTIONId';
      default:
        return null;
    }
  }

  private getAccessTokenColumn(platform: Platform): string | null {
    switch (platform) {
      case Platform.WEBSITE:
        return 'accessTokenCRMId';
      case Platform.APP:
        return 'accessTokenAPPId';
      case Platform.EXTENSION:
        return 'accessTokenEXTENTIONId';
      default:
        return null;
    }
  }

  // **************************************************************** Utils Functions ****************************************************************
  async verifyGoogleToken(code: string): Promise<TokenPayload> {
    try {
      const { tokens } = await this.googleClient.getToken(code);

      if (!tokens.id_token) {
        throw new UnauthorizedException('NO_ID_TOKEN_RECEIVED');
      }
      const ticket = await this.googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      return payload;
    } catch (error) {
      // Handle specific error scenarios
      const errorMessage = error.message.toLowerCase();
      if (
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('code was already redeemed')
      ) {
        throw new UnauthorizedException('GOOGLE_AUTH_CODE_INVALID');
      }
      if (errorMessage.includes('token used too late')) {
        throw new UnauthorizedException('GOOGLE_TOKEN_EXPIRED');
      }

      if (errorMessage.includes('invalid token')) {
        throw new UnauthorizedException('INVALID_GOOGLE_TOKEN');
      }

      if (errorMessage.includes('wrong number of segments')) {
        throw new UnauthorizedException('GOOGLE_TOKEN_MALFORMED');
      }

      if (errorMessage.includes('audience mismatch')) {
        throw new UnauthorizedException('INVALID_TOKEN_AUDIENCE');
      }
      throw new UnauthorizedException('GOOGLE_AUTH_ERROR');
    }
  }

  async validateUser(email: string, password: string, req: ECoreReq): Promise<unknown> {
    const user = await this.prisma.admin.findUnique({
      where: {
        email,
        isDeleted: false,
      },
    });

    if (!user) {
      await Promise.all([
        this.ipBlockingGuard.trackFailedAttempt(req.ip),
        this.emailBlockingGuard.trackFailedAttempt(email),
      ]);
      throw new UnauthorizedException('INVALID_CREDENTIAL');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('EMAIL_NOT_VERIFIED');
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('USER_ACCOUNT_DEACTIVATED');
    }

    if (!user.password) {
      throw new UnauthorizedException('INVALID_CREDENTIAL');
    }

    const isPasswordValid = await this.hashingService.comparePasswords(password, user.password);
    if (!isPasswordValid) {
      await Promise.all([
        this.ipBlockingGuard.trackFailedAttempt(req.ip),
        this.emailBlockingGuard.trackFailedAttempt(email),
      ]);
      throw new UnauthorizedException('INVALID_CREDENTIAL');
    }

    return user;
  }

  async validateUserStatus(userId: string): Promise<boolean> {
    try {
      // Get user with all required relations in a single query
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      // Check if user exists
      if (!user) {
        throw new NotFoundException({
          message: 'INVALID_EMAIL_OR_PASSWORD',
        });
      }

      // Check if profile is complete
      if (!user.name || !user.mobile) {
        throw new HttpException(
          {
            message: 'INCOMPLETE_PROFILE',
            data: {
              token: await this.jwtService.generateToken(user.id),
            },
          },
          HttpStatus.ACCEPTED,
        );
      }

      return true;
    } catch (error) {
      throw error;
    }
  }
}
