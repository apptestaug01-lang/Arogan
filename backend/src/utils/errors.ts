export class ApiError extends Error {
  statusCode: number
  isOperational: boolean
  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.isOperational = true
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(message, 400)
    this.name = 'ValidationError'
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(message, 409)
    this.name = 'ConflictError'
  }
}

export class StorageError extends ApiError {
  constructor(message: string) {
    super(message, 503)
    this.name = 'StorageError'
  }
}

export class DocumentValidationError extends ValidationError {
  constructor(message: string) {
    super(message)
    this.name = 'DocumentValidationError'
  }
}
