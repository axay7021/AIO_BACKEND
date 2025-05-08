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
import { ECoreReq, RequestUser } from 'src/common/interfaces/request.interface';
import { HashingService } from 'src/common/services/hashing.service';
import { generateOTP } from '@common/services/otp.service';
import { EmailService } from '@common/services/email.service';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { TokenUtils } from '@common/services/jwt.service';
import { v4 as uuidv4 } from 'uuid';
import {
  EditOrganizationResponse,
  EditProfileResponse,
  ForgotPasswordResponse,
  GetPlanDetailsResponse,
  GoogleSignupResponse,
  LoginResponse,
  OrganizationDetailResponse,
  ProfileDetailResponse,
  PurchasePlanResponse,
  RefreshTokenResponse,
  SignUpResponse,
  VerifyOtpResponse,
} from '@common/interfaces/admin/admin.interface';
import { GoogleSignupDto } from './dto/googleSignup.dto';
import { VerifyOtpDto } from './dto/otpVerify.dto';
import { HttpStatus } from '@common/constants/httpStatus.constant';
import { ResendOtpDto } from './dto/resendOtp.dto';
import { CompleteProfileDto } from './dto/completeProfile.dto';
import { OrganizationRegisterDto } from './dto/registerOrganization.dto';
import {
  AdminRole,
  BillingCycle,
  Organization,
  OrganizationMember,
  OrganizationSubscription,
  SubscriptionStatus,
  User,
  UserType,
  WorkerRole,
} from '@prisma/client';
import { ForgotPasswordDto } from './dto/forgotPassword.dto';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import { PurchasePlanDto } from './dto/purchasePlan.dto';
import { LoginDto } from './dto/login.dto';
import { Platform } from '@common/constants/prisma.constant';
import { GoogleSigninDto } from './dto/googleSignin.dto';
import { EditOrganizationDto } from './dto/editOrganization.dto';
import { CLOUDINARY_FOLDERS, CloudinaryService } from '@common/services/clodinary.service';
import { EditProfileDto } from './dto/editProfile.dto';
import { RefreshTokenDto } from './dto/refreshToken.dto';
import { OrganizationNameCheckDto } from './dto/organizationNameCheck.dto';
import { SubdomainCheckDto } from './dto/subdomainCheck.dto';

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

  async signup(req: ECoreReq, body: CreateAdminDto): Promise<SignUpResponse> {
    const email = body.email.trim().toLowerCase();

    // Check if email already exists
    const isEmailExists = await this.prisma.user.findUnique({
      where: {
        email,
        deleted: false,
      },
    });

    if (isEmailExists) {
      // Perform IP and Email blocking concurrently
      await Promise.all([
        this.ipBlockingGuard.trackFailedAttempt(req.ip),
        this.emailBlockingGuard.trackFailedAttempt(email),
      ]);

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
    const { user, userOtp } = await this.prisma.$transaction(async prisma => {
      const user = await prisma.user.create({
        data: {
          email: email,
          password: encryptedPassword,
          authProvider: 'EMAIL',
        },
      });

      const userOtp = await prisma.userOtp.create({
        data: {
          userId: user.id,
          crmOtp: otp,
          otpExpireTime: new Date(Date.now() + 5 * 60000), // 5 minutes
          nextOtpTime: new Date(Date.now() + 30000), // 30 seconds
        },
      });

      return { user, userOtp };
    });

    // Send OTP to email
    // await this.emailService.sendOtpToMail(email, { otp: otp });

    return {
      email: user.email,
      otp: otp.toString(),
    };
  }

  async googleSignup(body: GoogleSignupDto): Promise<GoogleSignupResponse | LoginResponse> {
    try {
      const payload = await this.verifyGoogleToken(body.token);

      // Check if user exists with this email
      const existingUser = await this.prisma.user.findUnique({
        where: {
          email: payload.email,
          deleted: false,
        },
        select: {
          id: true,
          authProvider: true,
          googleId: true,
          emailVerified: true,
          password: true,
          firstName: true,
          lastName: true,
          email: true,
          organizationMembers: {
            where: {
              organization: {
                isActive: true,
              },
            },
            include: {
              organization: {
                select: {
                  id: true,
                  isActive: true,
                  subscription: true,
                  name: true,
                  subdomain: true,
                },
              },
            },
          },
        },
      });
      console.log('Email exists', existingUser);

      if (existingUser) {
        // Update user's Google ID and email verification
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            googleId: payload.sub,
            emailVerified: true,
          },
        });

        if (
          existingUser.authProvider === 'EMAIL' &&
          !existingUser.firstName &&
          !existingUser.lastName
        ) {
          const updatedUser = await this.prisma.user.update({
            where: { id: existingUser.id },
            data: {
              firstName: payload?.given_name,
              lastName: payload?.family_name,
            },
          });

          return {
            token: await this.jwtService.generateToken(updatedUser.id),
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
          };
        }

        const isUserValid = await this.validateUserStatus(existingUser.id);

        if (!isUserValid) {
          throw new UnauthorizedException('USER_NOT_VALID');
        }

        // // generate crm tokens
        // // get default organization
        const orgMember = await this.getDefaultOrganization(existingUser.id);
        const subdomainTokenId = uuidv4();
        await this.prisma.organizationMember.update({
          where: {
            userId_organizationId: {
              userId: existingUser.id,
              organizationId: orgMember.organization.id,
            },
          },
          data: {
            accessTokenCRMId: null,
            refreshTokenCRMId: subdomainTokenId,
          },
        });
        const subdomainToken = await this.jwtService.generateSubdomainToken(
          existingUser.id,
          orgMember.organization.id,
          subdomainTokenId,
        );
        return {
          subdomainToken,
          organizationSubdomain: orgMember.organization.subdomain,
        };
      }
      // Create new user with Google data
      const newUser = await this.prisma.user.create({
        data: {
          email: payload.email,
          firstName: payload.given_name,
          lastName: payload.family_name,
          googleId: payload.sub,
          authProvider: 'GOOGLE',
          emailVerified: payload.email_verified,
        },
      });

      return {
        token: await this.jwtService.generateToken(newUser.id),
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
      };
    } catch (error) {
      throw error;
    }
  }

  async verifyOtp(req: ECoreReq, body: VerifyOtpDto): Promise<VerifyOtpResponse> {
    const { email, otp } = body;

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        password: true,
        emailVerified: true,
        isPasswordReset: true,
        otps: {
          select: {
            id: true,
            crmOtp: true,
            otpExpireTime: true,
            nextOtpTime: true,
          },
        },
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
    if (user?.otps[0]?.crmOtp?.toString() !== otp) {
      // Track failed attempt
      this.ipBlockingGuard.trackFailedAttempt(req.ip);
      this.emailBlockingGuard.trackFailedAttempt(body.email);

      throw new BadRequestException({
        message: 'INVALID_OTP',
        data: { email: body.email },
      });
    }

    // Check if OTP has expired
    if (!user?.otps[0]?.otpExpireTime || new Date() > user.otps[0]?.otpExpireTime) {
      throw new BadRequestException({
        message: 'OTP_EXPIRED',
        data: { email: body.email },
      });
    }

    // set email verfied
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
      },
    });

    // Clear the used OTP
    await this.prisma.userOtp.delete({
      where: { id: user.otps[0].id },
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

    console.log({ token });
    return {
      token,
      _statusCode: user.isPasswordReset ? HttpStatus.RESET_CONTENT : HttpStatus.ACCEPTED,
    };
  }

  async resendOtp(req: ECoreReq, body: ResendOtpDto): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: {
        email: body.email.toLowerCase().trim(),
      },
      select: {
        id: true,
        emailVerified: true,
        otps: {
          select: {
            id: true,
            crmOtp: true,
            otpExpireTime: true,
            nextOtpTime: true,
          },
        },
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
    if (
      user.otps.length > 0 &&
      user?.otps[0]?.nextOtpTime &&
      currentTime < user?.otps[0]?.nextOtpTime
    ) {
      // Perform IP and Email blocking concurrently
      this.ipBlockingGuard.trackFailedAttempt(req.ip);
      this.emailBlockingGuard.trackFailedAttempt(body.email);
      throw new BadRequestException({
        message: 'OTP_COOLDOWN_TIME',
      });
    }

    // Generate OTP
    const otp = generateOTP(6);

    await this.prisma.userOtp.update({
      where: { id: user?.otps[0]?.id },
      data: {
        crmOtp: otp,
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
      include: {
        organizationMembers: {
          include: {
            organization: {
              include: {
                subscription: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'INVALID_EMAIL_OR_PASSWORD',
      });
    }

    if (!user.firstName || !user.phoneNumber) {
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

    if (user.organizationMembers.length === 0) {
      throw new HttpException(
        {
          message: 'USER_NOT_ASSOCIATED_WITH_ANY_ORGANIZATION',
          data: {
            token: await this.jwtService.generateToken(user.id),
          },
        },
        203,
      );
    }

    // Find organization where user is an owner
    const ownedOrganization = user.organizationMembers.find(
      member => member.userType === UserType.OWNER,
    );

    // If user is an owner, check their subscription
    if (ownedOrganization) {
      if (ownedOrganization.organization.subscription === null) {
        throw new HttpException(
          {
            message: 'USER_NOT_TAKEN_ANY_PLAN',
            statusCode: 206,
            data: {
              organizationId: ownedOrganization.organization.id,
              token: await this.jwtService.generateToken(user.id),
            },
          },
          206,
        );
      }

      // Check if owner's subscription is active
      if (ownedOrganization.organization.subscription.status !== 'ACTIVE') {
        throw new HttpException(
          {
            message: 'USER_PLAN_DEACTIVATED',
            statusCode: 206,
          },
          206,
        );
      }
    } else {
      // If user is not an owner, check if they belong to an organization with active subscription
      const memberOrganization = user.organizationMembers;
      const hasSomeActiveSubscription = memberOrganization.some(
        member =>
          member.organization.subscription && member.organization.subscription.status === 'ACTIVE',
      );
      if (!hasSomeActiveSubscription) {
        throw new HttpException(
          {
            message: 'USER_PLAN_DEACTIVATED',
            statusCode: 400,
          },
          400,
        );
      }
    }
    return true;
  }

  async completeProfile(userId: string, body: CompleteProfileDto): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'INVALID_EMAIL_OR_PASSWORD',
      });
    }

    await this.prisma.user.update({
      where: { id: user?.id },
      data: {
        firstName: body.firstName ?? user.firstName,
        lastName: body.lastName ?? user.lastName,
        countryCode: body.countryCode ?? user.countryCode,
        phoneNumber: body.phoneNumber ?? user.phoneNumber,
      },
    });
    return true;
  }

  async registerOrganization(
    userId: string,
    body: OrganizationRegisterDto,
  ): Promise<{ organizationId: string; subdomain: string }> {
    const { orgName, orgCountry } = body;

    // Check if user already owns an organization
    const existingOwnership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        userType: UserType.OWNER,
      },
    });

    if (existingOwnership) {
      throw new BadRequestException({
        message: 'USER_ALREADY_REGISTERED',
      });
    }

    // check if organization name already taken or not.
    const existingOrg = await this.prisma.organization.findFirst({
      where: {
        name: {
          equals: orgName.trim(),
          mode: 'insensitive',
        },
      },
    });

    if (existingOrg) {
      throw new BadRequestException({
        message: 'ORGANIZATION_ALREADY_EXISTS',
      });
    }

    // Generate unique subdomain
    let subDomain = this.generateSubdomain(orgName);
    console.log('subDomain', subDomain);
    let subDomainExists = await this.prisma.organization.findFirst({
      where: { subdomain: subDomain },
    });

    while (subDomainExists) {
      const randomNum = Math.floor(100 + Math.random() * 900); // Generate a random 3-digit number
      subDomain = `${this.generateSubdomain(orgName)}-${randomNum}`;
      console.log('subDomain', subDomain);
      subDomainExists = await this.prisma.organization.findFirst({
        where: { subdomain: subDomain },
      });
    }

    const result = await this.prisma.$transaction(async tx => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: orgName,
          country: orgCountry,
          createdById: userId,
          subdomain: subDomain,
        },
      });

      // Create organization membership (owner)
      const orgMembership = await tx.organizationMember.create({
        data: {
          userId,
          organizationId: organization.id,
          userType: UserType.OWNER,
          adminRole: AdminRole.ADMIN,
          isDefaultOrganization: true,
        },
      });

      // Create default department
      const defaultDepartment = await tx.department.create({
        data: {
          name: 'General',
          description: 'Default department',
          organizationId: organization.id,
          createdBy: userId,
        },
      });

      // Add user to department
      const departmentMember = await tx.departmentMember.create({
        data: {
          userId,
          departmentId: defaultDepartment.id,
          workerRole: WorkerRole.ADMINISTRATOR,
          createdById: userId,
        },
      });

      return {
        organization,
        orgMembership,
        defaultDepartment,
        departmentMember,
      };
    });

    return {
      organizationId: result.organization.id,
      subdomain: result.organization.subdomain,
    };
  }

  async forgotPassword(req: ECoreReq, body: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    const user = await this.prisma.user.findUnique({
      where: {
        email: body.email.toLowerCase().trim(),
      },
      select: {
        id: true,
        otps: {
          select: {
            id: true,
            crmOtp: true,
            otpExpireTime: true,
            nextOtpTime: true,
          },
        },
      },
    });

    if (!user) {
      await Promise.all([
        this.ipBlockingGuard.trackFailedAttempt(req.ip),
        this.emailBlockingGuard.trackFailedAttempt(body.email),
      ]);
      throw new BadRequestException({
        message: 'INVALID_EMAIL_OR_PASSWORD',
        data: { email: body.email },
      });
    }
    console.log('user', user);
    const currentTime = new Date();
    if (
      user.otps.length > 0 &&
      user?.otps[0]?.nextOtpTime &&
      currentTime < user?.otps[0]?.nextOtpTime
    ) {
      // Perform IP and Email blocking concurrently
      this.ipBlockingGuard.trackFailedAttempt(req.ip);
      this.emailBlockingGuard.trackFailedAttempt(body.email);
      throw new BadRequestException({
        message: 'OTP_COOLDOWN_TIME',
      });
    }

    // Generate OTP
    const otp = generateOTP(6);

    await this.prisma.$transaction(async tx => {
      if (user.otps[0]?.crmOtp) {
        await tx.userOtp.update({
          where: { id: user.otps[0].id },
          data: {
            crmOtp: otp,
            otpExpireTime: new Date(Date.now() + 5 * 60000), // 5 minutes
            nextOtpTime: new Date(Date.now() + 30000), // 30 seconds
          },
        });
      } else {
        await tx.userOtp.create({
          data: {
            userId: user?.id,
            crmOtp: otp,
            otpExpireTime: new Date(Date.now() + 5 * 60000), // 5 minutes
            nextOtpTime: new Date(Date.now() + 30000), // 30 seconds
          },
        });
      }

      // Update user to set passwordResetRequested flag
      await tx.user.update({
        where: { id: user.id },
        data: {
          isPasswordReset: true,
        },
      });
    });

    // Send OTP to email
    // await this.emailService.sendOtpToMail(body.email, { otp: otp });

    return {
      otp: otp.toString(),
    };
  }

  async resetPassword(userId: string, body: ResetPasswordDto): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'INVALID_EMAIL_OR_PASSWORD',
      });
    }

    // Encrypt password
    const encryptedPassword = await this.hashingService.hashPassword(body.password);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: encryptedPassword,
        isPasswordReset: false,
      },
    });
    return true;
  }

  async getPlanDetail(): Promise<GetPlanDetailsResponse> {
    const plans = await this.prisma.plan.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        description: true,
        planType: true,
        monthlyPrice: true,
        yearlyPrice: true,
        isPopular: true,
        planFeatures: {
          where: {
            isEnabled: true,
          },
          select: {
            id: true,
            featureName: true,
            featureType: true,
          },
        },
      },
    });

    // divide plans into standard and premium categories
    const standardPlans = plans.filter(plan => plan.planType === 'STANDARD');
    const premiumPlans = plans.filter(plan => plan.planType === 'PREMIUM');

    return {
      standardPlans,
      premiumPlans,
    };
  }

  async purchasePlan(userId: string, body: PurchasePlanDto): Promise<PurchasePlanResponse> {
    const { organizationId, planId, memberCount, totalPrice, billingCycle } = body;

    // 1. Validate the user has permissions for this organization
    const orgMember = await this.prisma.organizationMember.findFirst({
      where: {
        userId: userId,
        organizationId,
      },
    });

    if (!orgMember) {
      throw new BadRequestException({
        message: 'USER_NOT_AUTHORIZED_TO_MANAGE_ORGANIZATION',
      });
    }

    if (orgMember.userType !== UserType.OWNER) {
      throw new BadRequestException('USER_DOES_NOT_HAVE_PERMISSION_TO_PURCHASE_PLANS');
    }

    // 2. Verify the plan exists
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('PLAN_NOT_FOUND');
    }

    if (!plan.isActive) {
      throw new BadRequestException('PLAN_IS_NOT_ACTIVE');
    }

    // 3. Check if organization already has an active subscription
    const existingSubscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId: organizationId },
    });

    if (existingSubscription && existingSubscription.status === SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('ORGANIZATION_ALREADY_HAS_AN_ACTIVE_SUBSCRIPTION');
    }

    // 4. Validate the total price
    const pricePerMember =
      billingCycle === BillingCycle.MONTHLY ? plan.monthlyPrice : plan.yearlyPrice;
    const expectedPrice = this.calculatePrice(
      pricePerMember,
      Number(memberCount),
      body.billingCycle,
    );

    console.log('Calculating price', expectedPrice, totalPrice);
    if (Math.abs(expectedPrice - Number(totalPrice)) > 0.01) {
      throw new BadRequestException('TOTAL_PRICE_CALCULATION_IS_INCORRECT');
    }

    const startDate = new Date();
    let endDate: Date = new Date(startDate);
    endDate =
      billingCycle === BillingCycle.MONTHLY
        ? new Date(endDate.setMonth(endDate.getMonth() + 1))
        : new Date(endDate.setFullYear(endDate.getFullYear() + 1));

    // 5. Create organization subscription
    await this.prisma.organizationSubscription.create({
      data: {
        memberCount: Number(memberCount),
        pricePerMember,
        totalPrice: Number(totalPrice),
        billingCycle,
        status: SubscriptionStatus.ACTIVE,
        startDate,
        endDate,
        nextBillingDate: endDate,
        organization: {
          connect: { id: organizationId },
        },
        plan: {
          connect: { id: planId },
        },
        createdBy: {
          connect: { id: userId },
        },
      },
    });

    const payload = {
      id: userId,
      organizationId,
    };

    // Using environment variables for token expiry
    const accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY_WEBSITE;
    const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY_WEBSITE;

    // if accessToken Id then only single device login
    const loginTokenNonce = uuidv4();
    const refreshTokenNonce = uuidv4();
    const { accessToken, refreshToken } = await this.jwtService.generateTokens(
      payload,
      'WEBSITE',
      accessTokenExpiry,
      refreshTokenExpiry,
      loginTokenNonce,
      refreshTokenNonce,
    );

    await this.prisma.organizationMember.update({
      where: {
        userId_organizationId: {
          userId: userId,
          organizationId,
        },
      },
      data: {
        accessTokenCRMId: loginTokenNonce,
        refreshTokenCRMId: refreshTokenNonce,
      },
    });
    return {
      accessToken,
      refreshToken,
      organizationId,
    };
  }

  async crmLogin(req: ECoreReq, body: LoginDto, platform: Platform): Promise<LoginResponse> {
    const { email, password } = body;

    // 1. Validate user credentials
    const user = await this.validateUser(email, password, req);

    // 2. Validate the user's status - will throw error if validation fails
    await this.validateUserStatus(user.id);

    // 2. Get the user's default organization
    const orgMember = await this.getDefaultOrganization(user.id);
    const organization = orgMember.organization;

    // 3. If user is an organization member, validate their subscription
    if (orgMember.userType !== 'OWNER') {
      await this.validateMemberSubscription(organization.id);
    }

    // 4. update last login time
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    // 5. Generate token 5 minutes to expire to store in subdomain cookie
    const subdomainTokenId = uuidv4();
    // store this id in database
    await this.prisma.organizationMember.update({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: organization.id,
        },
      },
      data: {
        accessTokenCRMId: null,
        refreshTokenCRMId: subdomainTokenId,
      },
    });
    const subdomainToken = await this.jwtService.generateSubdomainToken(
      user.id,
      organization.id,
      subdomainTokenId,
    );

    return {
      subdomainToken,
      organizationSubdomain: organization.subdomain,
    };
  }

  async verifySubdomainToken(subdomainToken: string): Promise<LoginResponse> {
    try {
      // decode the token
      const payload = await this.jwtService.verifySubdomainToken(subdomainToken);

      const { userId, organizationId, subdomainTokenNounce } = payload;

      // check if subdomain token is valid
      const checkSubdomainId = await this.prisma.organizationMember.findFirst({
        where: {
          userId,
          organizationId,
          refreshTokenCRMId: subdomainTokenNounce,
        },
      });

      if (!checkSubdomainId) {
        throw new UnauthorizedException('TOKEN_INVALID');
      }

      // null the subdomain token
      await this.prisma.organizationMember.update({
        where: {
          userId_organizationId: {
            userId,
            organizationId,
          },
        },
        data: {
          refreshTokenCRMId: null,
        },
      });

      // generate tokens

      const { accessToken, refreshToken } = await this.generateCrmTokens(
        userId,
        organizationId,
        Platform.WEBSITE,
      );
      return {
        accessToken,
        refreshToken,
        organizationId: organizationId,
        userId: userId,
      };
    } catch (error) {
      throw error;
    }
  }

  async appExtensionLogin(
    req: ECoreReq,
    body: LoginDto,
    platform: Platform,
  ): Promise<LoginResponse> {
    const { email, password } = body;

    // 1. Validate user credentials
    const user = await this.validateUser(email, password, req);

    // 2. Validate the user's status - will throw error if validation fails
    await this.validateUserStatus(user.id);

    // 3. Get the user's default organization
    const orgMember = await this.getDefaultOrganization(user.id);
    const organization = orgMember.organization;

    // 3. If user is an organization owner, validate their profile is complete
    await this.validateMemberSubscription(organization.id);

    // 4. update last login time
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    // 5. Generate tokens
    const payload = {
      id: user?.id,
      organizationId: organization?.id,
    };

    // Using environment variables for token expiry
    // Use platform-specific token expiry settings
    let accessTokenExpiry, refreshTokenExpiry;
    let accessTokenIdField, refreshTokenIdField;

    // Set appropriate token fields based on platform
    if (platform === Platform.APP) {
      accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY_APP;
      refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY_APP;
      accessTokenIdField = 'accessTokenAPPId';
      refreshTokenIdField = 'refreshTokenAPPId';
    } else if (platform === Platform.EXTENSION) {
      accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY_EXTENSION;
      refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY_EXTENSION;
      accessTokenIdField = 'accessTokenEXTENTIONId';
      refreshTokenIdField = 'refreshTokenEXTENTIONId';
    }

    // if accessToken Id then only single device login
    // Generate tokens with unique nonces
    const loginTokenNonce = uuidv4();
    const refreshTokenNonce = uuidv4();
    const { accessToken, refreshToken } = await this.jwtService.generateTokens(
      payload,
      platform,
      accessTokenExpiry,
      refreshTokenExpiry,
      loginTokenNonce,
      refreshTokenNonce,
    );

    // Update the appropriate token IDs based on platform
    await this.prisma.organizationMember.update({
      where: {
        userId_organizationId: {
          userId: user?.id,
          organizationId: organization?.id,
        },
      },
      data: {
        [accessTokenIdField]: loginTokenNonce,
        [refreshTokenIdField]: refreshTokenNonce,
      },
    });
    return {
      accessToken,
      refreshToken,
      organizationId: organization?.id,
      userId: user?.id,
      phoneNumber: user?.phoneNumber,
      organizationName: organization?.name,
      organizationSubdomain: organization?.subdomain,
    };
  }

  async googleLoginApp(req: ECoreReq, body: GoogleSigninDto): Promise<LoginResponse> {
    const { token } = body;

    // 1. Verify Google token
    const payload = await this.verifyGoogleToken(token);

    // 2. Check if user exists with this email
    const isUserExists = await this.prisma.user.findUnique({
      where: {
        email: payload?.email,
        deleted: false,
      },
    });

    if (!isUserExists) {
      // Perform IP and Email blocking concurrently
      await Promise.all([
        this.ipBlockingGuard.trackFailedAttempt(req.ip),
        this.emailBlockingGuard.trackFailedAttempt(payload?.email),
      ]);
      throw new UnauthorizedException('USER_NOT_FOUND');
    }

    // 3. Validate the user's status - will throw error if validation fails
    await this.validateUserStatus(isUserExists?.id);

    // 4. Get the user's default organization
    const orgMember = await this.getDefaultOrganization(isUserExists?.id);
    const organization = orgMember.organization;

    // 5. Validate the users's subscription
    await this.validateMemberSubscription(organization.id);

    await this.prisma.user.update({
      where: { id: isUserExists?.id },
      data: {
        googleId: payload.sub,
        emailVerified: true,
        lastLoginAt: new Date(),
      },
    });

    // 5. Generate tokens
    const tokenPayload = {
      id: isUserExists?.id,
      organizationId: organization?.id,
    };

    // if accessToken Id then only single device login
    // Generate tokens with unique nonces
    const loginTokenNonce = uuidv4();
    const refreshTokenNonce = uuidv4();
    const accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY_APP;
    const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY_APP;
    const { accessToken, refreshToken } = await this.jwtService.generateTokens(
      tokenPayload,
      Platform.APP,
      accessTokenExpiry,
      refreshTokenExpiry,
      loginTokenNonce,
      refreshTokenNonce,
    );
    // Update the appropriate token IDs based on platform
    await this.prisma.organizationMember.update({
      where: {
        userId_organizationId: {
          userId: isUserExists?.id,
          organizationId: organization?.id,
        },
      },
      data: {
        accessTokenAPPId: loginTokenNonce,
        refreshTokenAPPId: refreshTokenNonce,
      },
    });
    return {
      accessToken,
      refreshToken,
      organizationId: organization?.id,
      userId: isUserExists?.id,
      organizationName: organization?.name,
      organizationSubdomain: organization?.subdomain,
    };
  }

  async googleLoginCrm(req: ECoreReq, body: GoogleSigninDto): Promise<LoginResponse> {
    const { token } = body;

    // 1. Verify Google token
    const payload = await this.verifyGoogleToken(token);

    const isUserExists = await this.prisma.user.findUnique({
      where: {
        email: payload?.email,
        deleted: false,
      },
    });

    // 2. Check if user not exists with this email then create with google data
    if (!isUserExists) {
      // store googleId firstName and lastName
      const newUser = await this.prisma.user.create({
        data: {
          email: payload?.email,
          firstName: payload?.given_name,
          lastName: payload?.family_name,
          googleId: payload?.sub,
          emailVerified: payload?.email_verified,
          authProvider: 'GOOGLE',
        },
      });

      return {
        _statuscode: HttpStatus.CREATED,
        token: await this.jwtService.generateToken(newUser.id),
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        isProfileComplete: false,
      };
    }

    // 3. Validate the user's status - will throw error if validation fails
    await this.validateUserStatus(isUserExists?.id);

    // 4. Get the user's default organization
    const orgMember = await this.getDefaultOrganization(isUserExists?.id);
    const organization = orgMember.organization;

    // 5. Validate the users's subscription if user is not owner
    if (orgMember.userType !== 'OWNER') {
      await this.validateMemberSubscription(organization.id);
    }

    // 6. update last login time, googleId and email verification
    await this.prisma.user.update({
      where: { id: isUserExists?.id },
      data: {
        googleId: payload?.sub,
        emailVerified: true,
        lastLoginAt: new Date(),
      },
    });

    // 7. Generate tokens
    // store this id in database
    const subdomainTokenId = uuidv4();
    await this.prisma.organizationMember.update({
      where: {
        userId_organizationId: {
          userId: isUserExists?.id,
          organizationId: organization.id,
        },
      },
      data: {
        accessTokenCRMId: null,
        refreshTokenCRMId: subdomainTokenId,
      },
    });
    const subdomainToken = await this.jwtService.generateSubdomainToken(
      isUserExists?.id,
      organization.id,
      subdomainTokenId,
    );

    return {
      _statuscode: HttpStatus.SUCCESS,
      subdomainToken,
      organizationSubdomain: organization.subdomain,
    };
  }

  async editOrganization(
    user: RequestUser,
    body: EditOrganizationDto,
    orgImage: Express.Multer.File,
  ): Promise<EditOrganizationResponse> {
    const { organizationId } = user;
    const { orgName, orgSubdomain, orgCountry } = body;

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new UnauthorizedException('ORGANIZATION_NOT_FOUND');
    }

    // Check if user has permission (must be owner or admin)
    const userMembership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: user.userId,
        userType: { in: [UserType.OWNER, UserType.MANAGER] },
      },
    });

    if (!userMembership) {
      throw new UnauthorizedException('UNAUTHORIZED_ACCESS');
    }

    let cleanSubdomain = organization.subdomain;

    // Check if new subdomain is provided and validate it
    if (orgSubdomain && orgSubdomain !== organization.subdomain) {
      // Generate clean subdomain
      cleanSubdomain = this.generateSubdomain(orgSubdomain);

      // Check if new subdomain is already taken
      const existingSubdomain = await this.prisma.organization.findFirst({
        where: {
          subdomain: cleanSubdomain,
          id: { not: organizationId }, // Exclude current organization
        },
      });

      if (existingSubdomain) {
        throw new BadRequestException('SUBDOMAIN_ALREADY_EXISTS');
      }
    }

    // Check if new org name is provided and validate it
    if (orgName && orgName !== organization.name) {
      const existingOrg = await this.prisma.organization.findFirst({
        where: {
          name: {
            equals: orgName.trim(),
            mode: 'insensitive',
          },
          id: { not: organizationId }, // Exclude current organization
        },
      });

      if (existingOrg) {
        throw new BadRequestException('ORGANIZATION_ALREADY_EXISTS');
      }
    }

    // Image upload handling
    let imageUrl = organization.orgImageUrl ?? null;
    let imageKey = organization.orgImageKey ?? null;

    if (orgImage) {
      console.log({ orgImage: orgImage.path });
      const uploadedImage = await this.cloudinaryService.uploadImage(
        orgImage.path,
        CLOUDINARY_FOLDERS.ORGANIZATION_PROFILES,
      );

      if (imageKey) {
        const deletedImage = await this.cloudinaryService.deleteImage(imageKey);
        console.log({ deletedImage });
      }

      // Store new image information
      imageUrl = uploadedImage.secure_url;
      imageKey = uploadedImage.public_id;
    }

    // Update organization details
    const updatedOrganization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        name: orgName || organization.name,
        subdomain: cleanSubdomain || organization.subdomain,
        country: orgCountry || organization.country,
        orgImageUrl: imageUrl || organization.orgImageUrl,
        orgImageKey: imageKey || organization.orgImageKey,
      },
      select: {
        id: true,
        name: true,
        subdomain: true,
        country: true,
        orgImageUrl: true,
      },
    });

    return {
      organizationId: updatedOrganization.id,
      orgName: updatedOrganization.name,
      orgImage: updatedOrganization.orgImageUrl,
      orgSubdomain: updatedOrganization.subdomain,
      orgCountry: updatedOrganization.country,
    };
  }

  async getProfileDetail(user: RequestUser): Promise<ProfileDetailResponse> {
    const { userId, organizationId, platform } = user;

    const userDetails = await this.prisma.user.findFirst({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        profileImageUrl: true,
        profileImageKey: true,
        organizationMembers: {
          where: {
            organizationId: organizationId,
          },
          select: {
            userType: true,
            organization: {
              select: {
                subscription: {
                  select: {
                    plan: {
                      select: {
                        id: true,
                        name: true,
                        planType: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
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
      phoneNumber: userDetails.phoneNumber,
      profileImage: userDetails.profileImageUrl,
      planId: userDetails.organizationMembers[0].organization.subscription.plan.id,
      planType: userDetails.organizationMembers[0].organization.subscription.plan.planType,
      userType:
        userDetails.organizationMembers[0].userType === UserType.OWNER
          ? 'OWNER'
          : userDetails.organizationMembers[0].userType === UserType.MANAGER
            ? 'MANAGER'
            : 'WORKER',
      platform: platform,
    };
  }

  async editProfile(
    user: RequestUser,
    body: EditProfileDto,
    profileImage: Express.Multer.File,
  ): Promise<EditProfileResponse> {
    const { firstName, lastName, countryCode, phoneNumber } = body;
    const { userId } = user;

    const userDetails = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userDetails) {
      throw new BadRequestException('USER_NOT_FOUND');
    }

    let profileImageKey = userDetails.profileImageKey;
    let profileImageUrl = userDetails.profileImageUrl;

    if (profileImage) {
      console.log({ profileImage: profileImage.path });
      const uploadedImage = await this.cloudinaryService.uploadImage(
        profileImage.path,
        CLOUDINARY_FOLDERS.USER_PROFILE,
      );

      if (profileImageKey) {
        const deletedImage = await this.cloudinaryService.deleteImage(profileImageKey);
        console.log({ deletedImage });
      }

      profileImageKey = uploadedImage.public_id;
      profileImageUrl = uploadedImage.secure_url;
    }

    const updatedProfile = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: firstName ?? userDetails.firstName,
        lastName: lastName ?? userDetails.lastName,
        phoneNumber: phoneNumber ?? userDetails.phoneNumber,
        countryCode: countryCode ?? userDetails.countryCode,
        profileImageKey: profileImageKey ?? userDetails.profileImageKey,
        profileImageUrl: profileImageUrl ?? userDetails.profileImageUrl,
      },
    });

    return {
      userId: updatedProfile.id,
      firstName: updatedProfile.firstName,
      lastName: updatedProfile.lastName,
      phoneNumber: updatedProfile.phoneNumber,
      profileImage: updatedProfile.profileImageUrl,
      countryCode: updatedProfile.countryCode,
    };
  }

  async getOrganizationDetail(user: RequestUser): Promise<OrganizationDetailResponse> {
    const { organizationId } = user;

    const organization = await this.prisma.organization.findFirst({
      where: {
        id: organizationId,
        deleted: false,
      },
    });

    if (!organization) {
      throw new UnauthorizedException('ORGANIZATION_NOT_FOUND');
    }

    return {
      organizationId: organization.id,
      orgName: organization.name,
      orgImage: organization.orgImageUrl,
      orgSubdomain: organization.subdomain,
      orgCountry: organization.country,
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
    const user = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
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

    console.log('user[platformColumn]', user[platformColumn], accessTokenColumn);

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

    await this.prisma.organizationMember.update({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      data: {
        [accessTokenColumn]: accessTokenNonce,
      },
    });

    return {
      accessToken,
    };
  }

  async organizationNameCheck(
    user: RequestUser,
    query: OrganizationNameCheckDto,
  ): Promise<{ isAvailable: boolean }> {
    const { orgName } = query;

    // Check if the organization name already exists
    const existingOrg = await this.prisma.organization.findFirst({
      where: {
        name: {
          equals: orgName.trim(),
          mode: 'insensitive',
        },
      },
    });

    return {
      isAvailable: !existingOrg,
    };
  }

  async subdomainCheck(
    user: RequestUser,
    query: SubdomainCheckDto,
  ): Promise<{ isAvailable: boolean }> {
    const { orgSubdomain } = query;

    const existingSubdomain = await this.prisma.organization.findFirst({
      where: {
        subdomain: {
          equals: orgSubdomain.trim(),
          mode: 'insensitive',
        },
      },
    });

    return {
      isAvailable: !existingSubdomain,
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
      console.log('Google token payload:', payload);

      return payload;
    } catch (error) {
      // Handle specific error scenarios
      const errorMessage = error.message.toLowerCase();
      console.log({ errorMessage: error.message });
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
      console.log('error: ' + errorMessage);
      throw new UnauthorizedException('GOOGLE_AUTH_ERROR');
    }
  }

  private calculatePrice(
    basePrice: number,
    memberCount: number,
    billingCycle: BillingCycle,
  ): number {
    // Apply yearly discount if applicable
    const monthlyPrice = basePrice * memberCount;
    console.log('Monthly Price', monthlyPrice);
    if (billingCycle === BillingCycle.YEARLY) {
      return monthlyPrice * 12;
    }

    return Number(monthlyPrice.toFixed(2));
  }

  async validateUser(email: string, password: string, req: ECoreReq): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
        deleted: false,
      },
    });

    if (!user) {
      await Promise.all([
        this.ipBlockingGuard.trackFailedAttempt(req.ip),
        this.emailBlockingGuard.trackFailedAttempt(email),
      ]);
      throw new UnauthorizedException('INVALID_CREDENTIAL');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException('EMAIL_NOT_VERIFIED');
    }

    if (user.status === 'INACTIVE') {
      throw new UnauthorizedException('USER_ACCOUNT_DEACTIVATED');
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('USER_ACCOUNT_SUSPENDED');
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
        include: {
          organizationMembers: {
            include: {
              organization: {
                include: {
                  subscription: true,
                },
              },
            },
          },
        },
      });

      // Check if user exists
      if (!user) {
        throw new NotFoundException({
          message: 'INVALID_EMAIL_OR_PASSWORD',
        });
      }

      // Check if profile is complete
      if (!user.firstName || !user.phoneNumber) {
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

      // Check if user has any organization
      if (user.organizationMembers.length === 0) {
        throw new HttpException(
          {
            message: 'USER_NOT_ASSOCIATED_WITH_ANY_ORGANIZATION',
            data: {
              token: await this.jwtService.generateToken(user.id),
            },
          },
          203,
        );
      }

      // Find organization where user is an owner
      const ownedOrganization = user.organizationMembers.find(
        member => member.userType === UserType.OWNER,
      );

      // If user is an owner, check their subscription
      if (ownedOrganization) {
        if (ownedOrganization.organization.subscription === null) {
          throw new HttpException(
            {
              message: 'USER_NOT_TAKEN_ANY_PLAN',
              statusCode: 206,
              data: {
                organizationId: ownedOrganization.organization.id,
                token: await this.jwtService.generateToken(user.id),
              },
            },
            206,
          );
        }

        // Check if owner's subscription is active
        if (ownedOrganization.organization.subscription.status !== 'ACTIVE') {
          throw new HttpException(
            {
              message: 'USER_PLAN_DEACTIVATED',
              statusCode: 206,
            },
            206,
          );
        }
      } else {
        // If user is not an owner, check if they belong to an organization with active subscription
        const memberOrganization = user.organizationMembers;
        const hasSomeActiveSubscription = memberOrganization.some(
          member =>
            member.organization.subscription &&
            member.organization.subscription.status === 'ACTIVE',
        );
        if (!hasSomeActiveSubscription) {
          throw new HttpException(
            {
              message: 'USER_PLAN_DEACTIVATED',
              statusCode: 400,
            },
            400,
          );
        }
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  async getDefaultOrganization(userId: string): Promise<
    OrganizationMember & {
      organization: Organization & {
        subscription: OrganizationSubscription & {
          plan: { id: string; name: string };
        };
      };
    }
  > {
    // Then look for the default organization
    const orgMember = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        isDefaultOrganization: true,
      },
      include: {
        organization: {
          include: {
            subscription: {
              include: {
                plan: true,
              },
            },
          },
        },
      },
    });

    if (!orgMember) {
      throw new UnauthorizedException('NOT_FOUND_ORGANIZATION');
    }
    return orgMember;
  }

  async validateMemberSubscription(organizationId: string): Promise<boolean> {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: {
        organizationId,
      },
      select: {
        status: true,
        endDate: true,
      },
    });

    if (!subscription) {
      throw new UnauthorizedException('NO_SUBSCRIPTION_FOUND');
    }

    const now = new Date(); // Current UTC time
    const endDate = new Date(subscription?.endDate);

    // Check if subscription is active
    if (subscription.status !== 'ACTIVE') {
      throw new UnauthorizedException('INACTIVE_SUBSCRIPTION');
    }

    console.log({ subscription }, now, endDate);
    // Check if subscription has expired
    if (now > endDate) {
      throw new UnauthorizedException('SUBSCRIPTION_EXPIRED');
    }

    return true;
  }

  async generateCrmTokens(
    userId: string,
    organizationId: string,
    platform: Platform,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // Create token payload
    const tokenPayload = {
      id: userId,
      organizationId: organizationId,
    };

    // Get appropriate token expiry times
    const accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY_WEBSITE;
    const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY_WEBSITE;

    // Generate unique nonces for token tracking
    const loginTokenNonce = uuidv4();
    const refreshTokenNonce = uuidv4();

    // Generate the tokens
    const { accessToken, refreshToken } = await this.jwtService.generateTokens(
      tokenPayload,
      platform,
      accessTokenExpiry,
      refreshTokenExpiry,
      loginTokenNonce,
      refreshTokenNonce,
    );

    // Update organization member record with token identifiers
    await this.prisma.organizationMember.update({
      where: {
        userId_organizationId: {
          userId: userId,
          organizationId: organizationId,
        },
      },
      data: {
        accessTokenCRMId: loginTokenNonce,
        refreshTokenCRMId: refreshTokenNonce,
      },
    });

    // Return the tokens and IDs
    return {
      accessToken,
      refreshToken,
    };
  }

  public generateSubdomain(orgName: string): string {
    return orgName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^a-z0-9-]/g, '') // Remove special characters
      .slice(0, 20); // Limit to 20 characters for brevity
  }
}
