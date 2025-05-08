import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import type { IncomingHttpHeaders } from 'http';

// Supported languages type
export type SupportedLanguages = 'en' | 'es' | 'fr' | 'ja';

export type ECoreReq = ExpressRequest;

export type ECoreRes = ExpressResponse;

export interface CustomHeaders extends IncomingHttpHeaders {
  language: SupportedLanguages;
}

export interface RequestUser {
  userId: string;
  organizationId: string;
  userType: string;
  adminRole: string;
  platform: string;
}

export interface RequestAdmin {
  adminId: string;
  adminRole: string;
}

export type ECoreReqHeader = ECoreReq & CustomHeaders;

export type ECoreReqUser = ECoreReq & RequestUser & CustomHeaders;

export type ECoreReqAdmin = ECoreReq & RequestAdmin & CustomHeaders;
