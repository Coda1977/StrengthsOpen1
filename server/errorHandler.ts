import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// Standardized error response interface
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
    path: string;
    method: string;
  };
  meta?: {
    validation?: ValidationError[];
    stack?: string;
    context?: Record<string, any>;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code: string;
}

// Standard error codes
export const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  ONBOARDING_REQUIRED: 'ONBOARDING_REQUIRED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Resource Management
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_LIMIT_EXCEEDED: 'RESOURCE_LIMIT_EXCEEDED',
  
  // File Processing
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  FILE_PROCESSING_FAILED: 'FILE_PROCESSING_FAILED',
  SECURITY_THREAT_DETECTED: 'SECURITY_THREAT_DETECTED',
  
  // Database
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  
  // External Services
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  TIMEOUT: 'TIMEOUT'
} as const;

// Error class for standardized error handling
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly context?: Record<string, any>;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: any,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.context = context;
  }
}

// Validation error creator
export function createValidationError(
  message: string,
  field: string,
  value?: any,
  code: string = 'INVALID_VALUE'
): ValidationError {
  return { field, message, value, code };
}

// Helper function to create standardized error responses
export function createErrorResponse(
  req: Request,
  error: AppError | Error,
  requestId?: string
): ErrorResponse {
  const isAppError = error instanceof AppError;
  const isDevelopment = process.env.NODE_ENV === 'development';

  const response: ErrorResponse = {
    success: false,
    error: {
      code: isAppError ? error.code : ERROR_CODES.INTERNAL_ERROR,
      message: error.message,
      timestamp: new Date().toISOString(),
      requestId,
      path: req.path,
      method: req.method
    }
  };

  // Add details for app errors
  if (isAppError && error.details) {
    response.error.details = error.details;
  }

  // Add meta information in development
  if (isDevelopment) {
    response.meta = {
      stack: error.stack,
      context: isAppError ? error.context : undefined
    };
  }

  return response;
}

// Zod error parser
export function parseZodError(zodError: ZodError): ValidationError[] {
  return zodError.errors.map(err => {
    const field = err.path.join('.');
    let message = err.message;
    
    // Customize error messages for better UX
    switch (err.code) {
      case 'invalid_type':
        message = `Expected ${err.expected} but received ${err.received}`;
        break;
      case 'too_small':
        if (err.type === 'string') {
          message = `Must be at least ${err.minimum} characters long`;
        } else if (err.type === 'array') {
          message = `Must contain at least ${err.minimum} items`;
        }
        break;
      case 'too_big':
        if (err.type === 'string') {
          message = `Must be no more than ${err.maximum} characters long`;
        } else if (err.type === 'array') {
          message = `Must contain no more than ${err.maximum} items`;
        }
        break;
      case 'invalid_string':
        if (err.validation === 'email') {
          message = 'Must be a valid email address';
        } else if (err.validation === 'url') {
          message = 'Must be a valid URL';
        }
        break;
    }

    return createValidationError(message, field, err.input, err.code);
  });
}

// Main error handling middleware
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate request ID if not present
  const requestId = req.headers['x-request-id'] as string || 
                   Math.random().toString(36).substring(2, 15);

  let statusCode = 500;
  let errorResponse: ErrorResponse;

  // Handle different error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorResponse = createErrorResponse(req, err, requestId);
  } else if (err instanceof ZodError) {
    statusCode = 400;
    const validationErrors = parseZodError(err);
    const appError = new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      'Validation failed',
      400,
      { validationErrors }
    );
    errorResponse = createErrorResponse(req, appError, requestId);
    errorResponse.meta = { validation: validationErrors };
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    let code = ERROR_CODES.BAD_REQUEST;
    let message = 'File upload error';
    
    if (err.message.includes('File too large')) {
      code = ERROR_CODES.FILE_TOO_LARGE;
      message = 'File size exceeds maximum limit';
    } else if (err.message.includes('Unexpected field')) {
      code = ERROR_CODES.INVALID_INPUT;
      message = 'Unexpected file field';
    }
    
    const appError = new AppError(code, message, statusCode);
    errorResponse = createErrorResponse(req, appError, requestId);
  } else {
    // Generic error handling
    console.error(`Unhandled error [${requestId}]:`, err);
    const appError = new AppError(
      ERROR_CODES.INTERNAL_ERROR,
      process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      500
    );
    errorResponse = createErrorResponse(req, appError, requestId);
  }

  // Log error for monitoring
  console.error(`API Error [${requestId}]:`, {
    code: errorResponse.error.code,
    message: errorResponse.error.message,
    path: req.path,
    method: req.method,
    statusCode,
    userId: (req as any).user?.claims?.sub,
    timestamp: errorResponse.error.timestamp
  });

  res.status(statusCode).json(errorResponse);
}

// Success response helper
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export function createSuccessResponse<T>(
  data: T,
  requestId?: string,
  meta?: Partial<SuccessResponse<T>['meta']>
): SuccessResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      ...meta
    }
  };
}

// Common error creators
export const errors = {
  unauthorized: (message = 'Authentication required') =>
    new AppError(ERROR_CODES.UNAUTHORIZED, message, 401),
    
  forbidden: (message = 'Access denied') =>
    new AppError(ERROR_CODES.FORBIDDEN, message, 403),
    
  onboardingRequired: (message = 'Please complete your onboarding to access this feature') =>
    new AppError(ERROR_CODES.ONBOARDING_REQUIRED, message, 403, { code: 'ONBOARDING_REQUIRED' }),
    
  notFound: (resource = 'Resource', id?: string) =>
    new AppError(ERROR_CODES.RESOURCE_NOT_FOUND, `${resource} not found${id ? ` with ID: ${id}` : ''}`, 404),
    
  alreadyExists: (resource = 'Resource') =>
    new AppError(ERROR_CODES.RESOURCE_ALREADY_EXISTS, `${resource} already exists`, 409),
    
  validation: (message = 'Validation failed', details?: any) =>
    new AppError(ERROR_CODES.VALIDATION_ERROR, message, 400, details),
    
  fileTooLarge: (maxSize = '5MB') =>
    new AppError(ERROR_CODES.FILE_TOO_LARGE, `File size exceeds maximum limit of ${maxSize}`, 413),
    
  unsupportedFileType: (supportedTypes?: string[]) =>
    new AppError(
      ERROR_CODES.UNSUPPORTED_FILE_TYPE,
      `Unsupported file type${supportedTypes ? `. Supported types: ${supportedTypes.join(', ')}` : ''}`,
      415
    ),
    
  securityThreat: (details: string) =>
    new AppError(ERROR_CODES.SECURITY_THREAT_DETECTED, `Security threat detected: ${details}`, 400),
    
  rateLimit: (message = 'Rate limit exceeded. Please try again later') =>
    new AppError(ERROR_CODES.RATE_LIMIT_EXCEEDED, message, 429),
    
  externalService: (service: string, details?: string) =>
    new AppError(
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      `External service error: ${service}${details ? ` - ${details}` : ''}`,
      502
    ),
    
  database: (operation: string, details?: string) =>
    new AppError(
      ERROR_CODES.DATABASE_ERROR,
      `Database error during ${operation}${details ? `: ${details}` : ''}`,
      500
    )
};