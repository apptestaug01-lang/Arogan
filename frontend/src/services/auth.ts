import api from './api';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'BORROWER' | 'ADMIN' | 'ANALYST' | 'APPROVER';
  emailVerified: boolean;
  isActive: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
    user?: User;
  };
}

export interface SignupData {
  fullName: string;
  email: string;
  mobile?: string;
  countryCode: string;
  password: string;
  confirmPassword: string;
  role: 'BORROWER' | 'ADMIN' | 'ANALYST' | 'APPROVER';
}

export interface LoginPasswordData {
  identifier: string;
  password: string;
}

export interface OtpRequestData {
  identifier: string;
  channel: 'email' | 'sms';
}

export interface OtpVerifyData {
  identifier: string;
  code: string;
}

export async function signup(data: SignupData): Promise<AuthResponse> {
  const response = await api.post('/auth/signup', data);
  return response.data;
}

export async function loginWithPassword(
  data: LoginPasswordData,
): Promise<AuthResponse> {
  const response = await api.post('/auth/login/password', data);
  return response.data;
}

export async function requestOtp(
  data: OtpRequestData,
): Promise<AuthResponse> {
  const response = await api.post('/auth/login/otp/request', data);
  return response.data;
}

export async function verifyOtpAndLogin(
  data: OtpVerifyData,
): Promise<AuthResponse> {
  const response = await api.post('/auth/login/otp/verify', data);
  return response.data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function getCurrentUser(): Promise<{
  success: boolean;
  data: { user: User };
}> {
  const response = await api.get('/auth/me');
  return response.data;
}
