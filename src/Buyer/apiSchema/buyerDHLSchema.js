const Joi = require('@hapi/joi');


module.exports.validateDHLAddressSchema = Joi.object().keys({
  countryCode: Joi.string().required(),
  postalCode: Joi.string().required(), 
  cityName: Joi.string().required(), 
});



 module.exports.getDHLRateSchema = Joi.object({
   plannedShippingDateAndTime: Joi.string()
    .isoDate()
    .required()
    .error(new Error('plannedShippingDateAndTime must be a valid ISO date string (e.g. 2025-10-26T10:00:00GMT+01:00)')),

  shipperDetails: Joi.object({
    addressLine1: Joi.string().max(45).required(),
    addressLine2: Joi.string().max(45).allow('').optional(),
    addressLine3: Joi.string().max(45).allow('').optional(),
    postalCode: Joi.string().allow('').optional(),
    cityName: Joi.string().required(),
    countyName: Joi.string().allow('').optional(),
    countryCode: Joi.string().length(2).uppercase().required(),
  }).required(),

  receiverDetails: Joi.object({
    addressLine1: Joi.string().max(45).required(),
    addressLine2: Joi.string().max(45).allow('').optional(),
    addressLine3: Joi.string().max(45).allow('').optional(),
    postalCode: Joi.string().required(),
    cityName: Joi.string().required(),
    countyName: Joi.string().allow('').optional(),
    countryCode: Joi.string().length(2).uppercase().required(),
  }).required(),

  packages: Joi.array()
    .items(
      Joi.object({
        weight: Joi.number().positive().required(),
        dimensions: Joi.object({
          length: Joi.number().positive().required(),
          width: Joi.number().positive().required(),
          height: Joi.number().positive().required(),
        }).required(),
      })
    )
    .min(1)
    .required(),
});