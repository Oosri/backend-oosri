const adminManagementService = require('../services/adminManagementService');
const adminAuthService = require('../services/adminAuthService');
const constants = require('../constants');

module.exports.listAdmins = async (req, res) => {
  const response = { ...constants.customServerResponse };
  try {
    response.body = await adminManagementService.listAdmins();
    response.status = 200;
    response.message = constants.adminManagementMessage.ADMIN_LIST_FETCHED;
  } catch (error) {
    console.error('Controller: listAdmins', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.getAdmin = async (req, res) => {
  const response = { ...constants.customServerResponse };
  try {
    response.body = await adminManagementService.getAdminById(req.params.id);
    response.status = 200;
    response.message = constants.adminManagementMessage.ADMIN_FETCHED;
  } catch (error) {
    console.error('Controller: getAdmin', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.createAdmin = async (req, res) => {
  const response = { ...constants.customServerResponse };
  try {
    response.body = await adminAuthService.createAdmin(req.body);
    response.status = 201;
    response.message = constants.adminAuthMessage.SIGNUP_SUCCESS;
  } catch (error) {
    console.error('Controller: createAdmin (management)', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.updateAdmin = async (req, res) => {
  const response = { ...constants.customServerResponse };
  try {
    response.body = await adminManagementService.updateAdmin({
      adminId: req.params.id,
      requesterId: req.adminUser._id.toString(),
      updates: req.body,
    });
    response.status = 200;
    response.message = constants.adminManagementMessage.ADMIN_UPDATED;
  } catch (error) {
    console.error('Controller: updateAdmin', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.deleteAdmin = async (req, res) => {
  const response = { ...constants.customServerResponse };
  try {
    await adminManagementService.deleteAdmin({
      adminId: req.params.id,
      requesterId: req.adminUser._id.toString(),
    });
    response.status = 200;
    response.message = constants.adminManagementMessage.ADMIN_DELETED;
  } catch (error) {
    console.error('Controller: deleteAdmin', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};
