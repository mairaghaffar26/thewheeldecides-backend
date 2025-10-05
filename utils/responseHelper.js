// Standardized response helper functions following reference project style

const successResponse = (res, data, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    });
};

const errorResponse = (res, error, message = 'Error', statusCode = 500) => {
    return res.status(statusCode).json({
        success: false,
        message,
        error: error.message || error,
        timestamp: new Date().toISOString()
    });
};

const validationErrorResponse = (res, errors) => {
    return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors,
        timestamp: new Date().toISOString()
    });
};

const notFoundResponse = (res, resource = 'Resource') => {
    return res.status(404).json({
        success: false,
        message: `${resource} not found`,
        timestamp: new Date().toISOString()
    });
};

const unauthorizedResponse = (res, message = 'Unauthorized') => {
    return res.status(401).json({
        success: false,
        message,
        timestamp: new Date().toISOString()
    });
};

const forbiddenResponse = (res, message = 'Forbidden') => {
    return res.status(403).json({
        success: false,
        message,
        timestamp: new Date().toISOString()
    });
};

module.exports = {
    successResponse,
    errorResponse,
    validationErrorResponse,
    notFoundResponse,
    unauthorizedResponse,
    forbiddenResponse
};
