export interface SuccessResponse<T = object> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
}

export interface ErrorResponse<T = object> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
}
