const Admin = require('../Model/adminAuthModel');
const constants = require('../constants');
const { verifyJwt } = require('../../utils/jwt');

module.exports.validateToken = (req, res, next) => {
  let response = { ...constants.customServerResponse };
  try {
    if (!req.headers.authorization) {
      throw new Error(constants.requestValidationMessage.TOKEN_MISSING);
    }
    const token = req.headers.authorization.split('Bearer')[1].trim();
    const decoded = verifyJwt(token);
    req.user = decoded; 
    next();
  } catch (error) {
    console.error('Error', error);
    response.message = error.message;
    response.status = 401;
    return res.status(response.status).send(response);
  }
};
module.exports.isAdmin = async (req, res, next) => {
  try {
    const user = await Admin.findById(req.user.id);
    if (!user || !['admin', 'super_admin'].includes(user.userRoles)) {
      return res.status(403).send({ message: constants.requestValidationMessage.FORBIDDEN });
    }
    req.adminUser = user; // attach for downstream middleware
    next();
  } catch (error) {
    console.error('Something went wrong: Middleware: isAdmin', error);
    return res.status(500).send({ message: 'Internal server error' });
  }
};

module.exports.isSuperAdmin = async (req, res, next) => {
  try {
    const user = req.adminUser || await Admin.findById(req.user.id);
    if (!user || user.userRoles !== 'super_admin') {
      return res.status(403).send({ message: constants.requestValidationMessage.SUPER_ADMIN_ONLY });
    }
    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Something went wrong: Middleware: isSuperAdmin', error);
    return res.status(500).send({ message: 'Internal server error' });
  }
};

module.exports.requirePermission = (module) => async (req, res, next) => {
  try {
    const user = req.adminUser || await Admin.findById(req.user.id);
    if (!user) {
      return res.status(403).send({ message: constants.requestValidationMessage.FORBIDDEN });
    }
    if (user.userRoles === 'super_admin') return next();
    if (!user.permissions || !user.permissions.includes(module)) {
      return res.status(403).send({
        message: `Access denied. You do not have permission to manage ${module}.`,
      });
    }
    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Something went wrong: Middleware: requirePermission', error);
    return res.status(500).send({ message: 'Internal server error' });
  }
};

module.exports.isValidPassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasDigits = /\d/.test(password);

  return (
    password.length >= minLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasDigits
  );
};




module.exports.generateStrongPassword =  (length = 10) => {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const all = upper + lower + digits;
  while (true) {
    let password = '';
    for (let i = 0; i < length; i++) {
      password += all.charAt(Math.floor(Math.random() * all.length));
    }

    if (
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /\d/.test(password)
    ) {
      return password;
    }
  }
}
