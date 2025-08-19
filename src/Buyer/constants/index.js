module.exports = {
  customServerResponse: {
    status: 400,
    message: '',
    body: {}
  },
  buyerProductMessage: {
    PRODUCT_CREATED: 'Product Created Successfully',
    PRODUCT_FETCHED: 'Product(s) Fetched Successfully',
    PRODUCT_UPDATED: 'Product Updated Successfully',
    PRODUCT_REMOVED: 'Product Removed Successfully',
    PRODUCT_NOT_FOUND: 'Product Not Found',
    SEARCH_NOT_FOUND: 'We couldn\'t locate what you\'re search for. Try a different keyword or describe your need, and rest assured, we\'ll get in touch once we locate it.',
    EMPTY_PRODUCT: 'No Product Found',
    PRODUCT_ITEM_REQUIRE: "productId and quantityChange are required",
    INVALID_PRODUCT_ID:  "One or more product IDs are invalid",
    ALGOLIA_SYNC: "Products successfully synced to Algolia",
    SEARCH_TERM_REQUIRED: "Search term is required",
     PRODUCT_ID_NOT_FOUND: (productId) => `Product with ID ${productId} not found`
  },
  shippingRateMessages:{
    RETRIEVE_SHIPPING_RATE: "Shipping rate retrieved successfully"
 },
  CartMessage: {
    CART_CREATED: 'Product Successfully Added to Cart',
    CART_FETCHED: 'Cart(s) Fetched Successfully',
    CART_UPDATED: 'Cart Updated Successfully',
    CART_REMOVED: 'Item Remove from Cart',
    CART_MERGED: 'Cart Merge Successfully',
    INVALID_CART_KEY: 'Cart Key Missing or Invalid ',
    USER_ID_CART_KEY_REQUIRED: 'Either userId or cartKey must be provided.',
    EMPTY_CART: 'No Item Found in Cart',
    CART_KEY_GENERATED: 'Cart Key Generated Successfully',
   
  },
  buyerSavedItemsMessage: {
    BUYER_SAVED_ITEM_CREATED: 'Product Saved for Later Purchase',
    BUYER_SAVED_ITEM_FETCHED: 'Saved Product(s) Fetched Successfully',
    BUYER_SAVED_ITEM_EXIST: 'Product is Already Saved for Later Purchase',
    BUYER_SAVED_ITEM_REMOVED: 'Product Removed from Saved List',
    BUYER_EMPTY_SAVED_ITEM: 'You have no Saved Product',
    BUYER_UNAUTHORIZED: 'Unauthorized Access to Saved products',
    ITEM_NOT_FOUND: "Item not Found in Saved List"
   
  },
  buyerContactUsMessage: {
    SUCCESS: 'success',
  },
  buyerOrderMessage: {
    ORDER_CREATED: 'Order Placed Successfully',
    ORDER_FETCHED: 'Order(s) Fetched Successfully',
    ORDER_REMOVED: 'Order Removed Successfully',
    ORDER_NOT_FOUND: 'Order Not Found',
    USER_ORDER_NOT_FOUND: 'No Order Found For User',
    ORDER_UPDATED: 'Order Updated Successfully',
    UNAUTHORIZED_ORDER: 'Order not found or not authorized to cancel this order',
    CANCELLATION_NOT_ALLOWED: 'Order cannot be cancelled at this stage',
    CANCELLED_ORDER: 'Order cancelled successfully',
    INVALID_ORDER_ID: 'Invalid order id',
  },
  paymentServiceMessage: {
    INITIALIZE_SUCCESS: 'Payment initialized successfully',
    VERIFY_SUCCESS: 'Payment verified successfully',
    INITIALIZED_FAILED: "Payment initialization failed",
    VERIFY_FAILED: "Payment verification failed"
  },
  deliveryFeeMessage: {
    DELIVERY_FEE_CREATED: 'Delivery fee Added Successfully',
    DELIVERY_FEE_FETCHED: 'Delivery fee (s) Fetched Successfully',
    DELIVERY_FEE_UPDATED: 'Delivery fee Updated Successfully',
    DELIVERY_FEE_REMOVED: 'Delivery fee Removed Successfully',
    Delivery_FEE_NOT_FOUND: 'Delivery fee not found',
  },
  reviewMessage: {
    REVIEW_CREATED: 'Review added Successfully',
    REVIEW_FETCHED: 'Review(s)  Fetched Successfully',
    REVIEW_REMOVED: 'Review Removed Successfully',
    REVIEW_NOT_FOUND: 'Review Not Found',
    REVIEW_UPDATED: 'Review Updated Successfully',
    INVALID_RATE_NUMBER: 'Invalid rating value. Rating must be a number between 1 and 5.',
    REVIEW_UNAUTHORIZED: "Access denied",
    USER_NOT_FOUND: 'User not found',
  },
  buyerProfileMessage: {
    USERPROFILE_CREATED: 'Profile Added Successfully',
    USERPROFILE_FETCHED: 'Profile Fetched Successfully',
    USERPROFILE_UPDATED: 'Profile Update Successfully',
    USERPROFILE_NOT_FOUND: 'Profile not found',
    USERPROFILE_DELETED: 'Profile Deleted Successfully ',
    PROFILE_IMAGE_UPLOAD: 'Profile Image Uploaded Successfully',
    INVALID_OLD_PASSWORD: 'Old password is incorrect',
    PASSWORD_CHANGED_SUCCESSFULLY: 'Password changed successfully',
    PASSWORD_SAME_AS_OLD: "Your new password cannot be the same as your current password.",
    PASSWORD_CHANGED_SUCCESS: 'Password changed successfully',
  
  },
  buyerAuthMessage: {
    SIGNUP_SUCCESS: 'Signup Success',
    LOGIN_SUCCESS: 'Login Success',
    DUPLICATE_EMAIL: 'User already Exist with given Email',
    EMAIL_NOT_ALLOWED: 'You are not allow to register with this email',
    USER_NOT_FOUND: 'User Not Found',
    INVALID_PASSWORD: 'Incorrect Password',
    INVALID_EMAIL: 'Invalid Email Format',
    WEAK_PASSWORD: 'Weak password. Password must Contain at Least 8 Characters Including Uppercase, Lowercase and Digit',
    RESET_NEW_PASSWORD: 'Password Reset Successfully.',
    MATCH_PASSWORD: 'New Password and Confirm Password must Match.',
    INVALID_TOKEN: 'Invalid otp code .',
    TOKEN_SENT: "An Otp Code has been sent to your Email",
    TOKEN_EXPIRED: "Otp code has Expired",
    FIELD_REQUIRED: "All Field are Required",
    EMAIL_ALREADY_CONFIRMED: 'Email Address has already been Confirmed.',
    EMAIL_NOT_CONFIRMED: 'Please verify your email before logging in',
    CONFIRM_TOKEN_SUCCESS: 'Email Confirmed Successfully',
    REFRESH_TOKEN_MISSING: "Refresh Token Missing",
    USER_FETCH_SUCCESS: "Current User Fetched Successfully",
    REFRESH_TOKEN_SUCCESS: "Token Generated Successfully ",
    INVALID_REFRESH_MISSING: "Invalid Refresh Token"
  },
  requestValidationMessage: {
    BAD_REQUEST: 'Invalid fields',
    TOKEN_MISSING: 'Token missing from header',
    FORBIDDEN: 'Access denied. Admins only.',
  },
  paymentServiceMessage: {
    INITIALIZE_SUCCESS: 'Payment initialized successfully',
    VERIFY_SUCCESS: 'Payment verified successfully',
    INITIALIZED_FAILED: "Payment initialization failed",
    VERIFY_FAILED: "Payment verification failed"
  },
  databaseMessage: {
    INVALID_ID: 'Invalid Id'
  }
}
