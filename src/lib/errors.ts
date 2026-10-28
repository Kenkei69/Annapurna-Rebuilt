export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", code = "NOT_FOUND") {
    super(message, 404, code);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict with current state", code = "CONFLICT") {
    super(message, 409, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Action forbidden", code = "FORBIDDEN") {
    super(message, 403, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", code = "UNAUTHORIZED") {
    super(message, 401, code);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", code = "VALIDATION_FAILED") {
    super(message, 400, code);
  }
}
