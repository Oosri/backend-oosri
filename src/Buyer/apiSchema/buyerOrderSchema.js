const Joi = require('@hapi/joi');


module.exports.createOrderSchema = Joi.object().keys({
  cartId: Joi.string().hex().length(24).required(),
 deliveryAddresses: Joi.object({
      address: Joi.string().required(),
      postalCode: Joi.string().required(),
      cityName: Joi.string().allow('', null),
      countryCode: Joi.string().allow('', null),
      countryName: Joi.string().allow('', null),
    })
  .min(1)
  .required(),
  postalCode: Joi.string().optional(),
  phoneNumber: Joi.string().required(), 
  paymentMethod: Joi.string().required(), 
  deliveryFee: Joi.number().optional(), 
  landMark: Joi.string().optional(), 
 
});

module.exports.updateOrderSchema = Joi.object().keys({
    contactPerson: Joi.string().optional(),
    orderStatus: Joi.string().optional(),
    deliveryAddress: Joi.string().optional(),
    orderNote: Joi.string().allow('').optional(),
    phoneNumber: Joi.string().optional(),
    totalProduct: Joi.number().optional(),
    items: Joi.array().items(
      Joi.object().keys({
        productId: Joi.string().hex().length(24).required(),
        quantity: Joi.number().required()
      })
    ).optional(),
    userId: Joi.string().hex().length(24).optional(),
    quantity: Joi.number().optional(),
  totalAmount: Joi.number().optional(),
  });

module.exports.retrieveOrderSchema = Joi.object().keys({
    skip: Joi.string().optional(),
    limit: Joi.string().optional()
  });
