const Joi = require('@hapi/joi');


module.exports.validateDHLAddressSchema = Joi.object().keys({
  countryCode: Joi.string().required(),
  postalCode: Joi.string().required(),
  cityName: Joi.string().required(),
});



module.exports.getDHLRateSchema = Joi.object({
  plannedShippingDateAndTime: Joi.string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:GMT[+-]\d{2}:\d{2})?$/)
    .optional()
    .error(new Error('plannedShippingDateAndTime must be a valid ISO date string (e.g. 2025-10-26T10:00:00GMT+01:00)')),

  addressId: Joi.string().required(),
<<<<<<< HEAD
  serviceType: Joi.string().trim().max(100).optional(),
=======
>>>>>>> 1b652e5e60af23c891410e2aa18e8746d1331f32

  items: Joi.array().items(
    Joi.object({
      productId: Joi.string().required(),
      quantity: Joi.number().integer().min(1).required()
    })
  ).min(1).required()
});




module.exports.getDHLPickupSchema = Joi.object({
  plannedPickupDateAndTime: Joi.string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:GMT[+-]\d{2}:\d{2})?$/
    )
    .required()
    .error(
      new Error(
        'plannedPickupDateAndTime must be a valid ISO date string (e.g. 2025-10-26T10:00:00GMT+01:00)'
      )
    ),

  closeTime: Joi.string()
    .regex(/^([0-1]\d|2[0-3]):([0-5]\d)$/)
    .required()
    .error(new Error('closeTime must be in HH:MM 24-hour format')),

  location: Joi.string()
    .max(100)
    .required()
    .error(new Error('location is required and must not exceed 100 characters')),

  locationType: Joi.string()
    .valid('business', 'residential')
    .required()
    .error(new Error('locationType must be either business or residential')),

  accounts: Joi.array()
    .items(
      Joi.object({
        number: Joi.string().required(),
        typeCode: Joi.string().valid('shipper').required(),
      })
    )
    .optional(),

  specialInstructions: Joi.array()
    .items(
      Joi.object({
        value: Joi.string().required(),
        typeCode: Joi.string().required(),
      })
    )
    .optional(),

  customerDetails: Joi.object({
    shipperDetails: Joi.object({
      postalAddress: Joi.object({
        addressLine1: Joi.string().max(45).required(),
        addressLine2: Joi.string().max(45).optional(),
        addressLine3: Joi.string().max(45).optional(),
        postalCode: Joi.string().required(),
        cityName: Joi.string().required(),
        countyName: Joi.string().allow('').optional(),
        countryCode: Joi.string().length(2).uppercase().required(),
      }).required(),
      contactInformation: Joi.object({
        fullName: Joi.string().max(100).required(),
        companyName: Joi.string().max(100).required(),
        email: Joi.string().email().required(),
        phone: Joi.string().max(20).required(),
      }).required(),
    }).required(),

    receiverDetails: Joi.object({
      postalAddress: Joi.object({
        addressLine1: Joi.string().max(45).required(),
        addressLine2: Joi.string().max(45).optional(),
        addressLine3: Joi.string().max(45).optional(),
        postalCode: Joi.string().required(),
        cityName: Joi.string().required(),
        countyName: Joi.string().allow('').optional(),
        countryCode: Joi.string().length(2).uppercase().required(),
      }).required(),
      contactInformation: Joi.object({
        fullName: Joi.string().max(100).required(),
        companyName: Joi.string().max(100).required(),
        email: Joi.string().email().required(),
        phone: Joi.string().max(20).required(),
      }).required(),
    }).required(),
  }).required(),

  shipmentDetails: Joi.array()
    .items(
      Joi.object({
        productCode: Joi.string().required(),
        isCustomsDeclarable: Joi.boolean().required(),
        declaredValue: Joi.number().positive().required(),
        declaredValueCurrency: Joi.string().length(3).uppercase().required(),
        unitOfMeasurement: Joi.string()
          .valid('metric', 'imperial')
          .required(),
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
      })
    )
    .min(1)
    .required(),
});
