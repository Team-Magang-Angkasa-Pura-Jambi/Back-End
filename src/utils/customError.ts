/**
 * ===========================================================================
 * BASE ERROR CLASS
 * ===========================================================================
 */



export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly errors: any; // Properti untuk menampung error terstruktur

  constructor(statusCode: number, message: string, errors?: any) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors; // Simpan payload error

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}

/**
 * ===========================================================================
 * 4xx CLIENT ERRORS
 * ===========================================================================
 */

// 400 Bad Request
export class Error400 extends HttpError {
  constructor(message: string = 'Bad Request') {
    super(400, message, 'BadRequest');
  }
}

// 401 Unauthorized
export class Error401 extends HttpError {
  constructor(message: string = 'Unauthorized') {
    super(401, message, 'Unauthorized');
  }
}

// 403 Forbidden
export class Error403 extends HttpError {
  constructor(message: string = 'Forbidden') {
    super(403, message, 'Forbidden');
  }
}

// 404 Not Found
export class Error404 extends HttpError {
  constructor(message: string = 'Not Found') {
    super(404, message, 'NotFound');
  }
}

// 405 Method Not Allowed
export class Error405 extends HttpError {
  constructor(message: string = 'Method Not Allowed') {
    super(405, message, 'MethodNotAllowed');
  }
}

// 409 Conflict
export class Error409 extends HttpError {
  constructor(message: string = 'Conflict') {
    super(409, message, 'Conflict');
  }
}

// 422 Unprocessable Entity (sering digunakan untuk validasi)
export class Error422 extends HttpError {
  constructor(message: string = 'Unprocessable Entity') {
    super(422, message, 'UnprocessableEntity');
  }
}

// 429 Too Many Requests (untuk rate limiting)
export class Error429 extends HttpError {
  constructor(message: string = 'Too Many Requests') {
    super(429, message, 'TooManyRequests');
  }
}

/**
 * ===========================================================================
 * 5xx SERVER ERRORS
 * ===========================================================================
 */

// 500 Internal Server Error
export class Error500 extends HttpError {
  constructor(message: string = 'Internal Server Error') {
    super(500, message, 'InternalServerError');
  }
}

// 502 Bad Gateway
export class Error502 extends HttpError {
  constructor(message: string = 'Bad Gateway') {
    super(502, message, 'BadGateway');
  }
}

// 503 Service Unavailable
export class Error503 extends HttpError {
  constructor(message: string = 'Service Unavailable') {
    super(503, message, 'ServiceUnavailable');
  }
}

// 504 Gateway Timeout
export class Error504 extends HttpError {
  constructor(message: string = 'Gateway Timeout') {
    super(504, message, 'GatewayTimeout');
  }
}
