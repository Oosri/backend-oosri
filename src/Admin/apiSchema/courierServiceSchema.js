const Joi = require('@hapi/joi');

module.exports.createCourierServiceSchema = Joi.object().keys({
    name: Joi.string().required(),
});
