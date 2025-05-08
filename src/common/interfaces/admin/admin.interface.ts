export type mailData = {
  otp: number;
};

export interface GoogleSignupResponse {
  email: string;
  firstName: string;
  lastName: string;
  token: string;
  organizationId?: string;
  organizationName?: string;
  organizationSubdomain?: string;
}

export interface SignUpResponse {
  email: string;
  otp: string;
}

export interface VerifyOtpResponse {
  token: string;
  _statusCode: number;
}

export interface ForgotPasswordResponse {
  otp: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  planType: string;
  monthlyPrice: number;
  yearlyPrice: number;
  planFeatures: {
    featureName: string;
    featureType: string;
  }[];
}

export interface GetPlanDetailsResponse {
  standardPlans: Plan[];
  premiumPlans: Plan[];
}

export interface PurchasePlanResponse {
  accessToken: string;
  refreshToken: string;
  organizationId: string;
}

export interface LoginResponse {
  // Standard JWT login response fields
  accessToken?: string;
  refreshToken?: string;
  organizationId?: string;
  userId?: string;
  phoneNumber?: string;

  // Google auth response fields
  token?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  isProfileComplete?: boolean;

  // Organization fields
  organizationName?: string;
  organizationSubdomain?: string;
  subdomainToken?: string;

  // Status code
  _statuscode?: number;
}

export interface EditOrganizationResponse {
  organizationId: string;
  orgName: string;
  orgImage: string;
  orgSubdomain: string;
  orgCountry: string;
}

export interface ProfileDetailResponse {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  profileImage: string;
  planId: string;
  planType: string;
  userType: string;
  platform: string;
}

export interface EditProfileResponse {
  userId: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  profileImage: string;
  countryCode: string;
}

export interface OrganizationDetailResponse {
  organizationId: string;
  orgName: string;
  orgImage: string;
  orgSubdomain: string;
  orgCountry: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
}
