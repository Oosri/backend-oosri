module.exports = {
  customServerResponse: {
    status: 400,
    message: '',
    body: {}
  },
  productMessage: {
    PRODUCT_CREATED: 'Product Created Successfully',
    PRODUCT_FETCHED: 'Product(s) Fetched Successfully',
    PRODUCT_UPDATED: 'Product Updated Successfully',
    PRODUCT_REMOVED: 'Product Removed Successfully',
    PRODUCT_NOT_FOUND: 'Product Not Found',
    EMPTY_PRODUCT: 'No Product Found',
    PRODUCT_ITEM_REQUIRE: "productId and quantityChange are required",
    INVALID_PRODUCT_ID:  "One or more product IDs are invalid",
    MOQ_NOT_MET: (productName, moq) => `The quantity for product ${productName} must be at least ${moq}`,
     PRODUCT_ID_NOT_FOUND: (productId) => `Product with ID ${productId} not found`
  },
  CartMessage: {
    CART_CREATED: 'Product Successfully Added to Cart',
    CART_FETCHED: 'Cart(s) Fetched Successfully',
    CART_UPDATED: 'Cart Updated Successfully',
    CART_REMOVED: 'Product Remove from Cart',
     EMPTY_CART: 'No Item Found in Cart'
   
  },
  userWhishListMessage: {
    USER_WISHLIST_CREATED: 'Product Saved for Later Purchase',
    USER_WISHLIST_FETCHED: 'Saved Product(s) Fetched Successfully',
    USER_WISHLIST_EXIST: 'Product is Already Saved for Later Purchase',
    USER_WISHLIST_REMOVED: 'Product Removed from Saved List',
    EMPTY_USER_WISHLIST: 'You have no Saved Product',
    USER_UNAUTHORIZED: 'Unauthorized Access to Saved products',
    ITEM_NOT_FOUND: "Item not Found in Saved List"
   
  },
  orderMessage: {
    ORDER_CREATED: 'Order Placed Successfully',
    ORDER_FETCHED: 'Order(s) Fetched Successfully',
    ORDER_REMOVED: 'Order Removed Successfully',
    ORDER_NOT_FOUND: 'Order Not Found',
    USER_ORDER_NOT_FOUND: 'No Order Found For User',
    ORDER_UPDATED: 'Order Updated Successfully',
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
    REVIEW_UNAUTHORIZED: "Access denied",
    USER_NOT_FOUND: 'User not found',
  },
  userProfileMessage: {
    USERPROFILE_CREATED: 'User Profile Added Successfully',
    USERPROFILE_FETCHED: 'User Profile Fetched Successfully',
    USERPROFILE_UPDATED: 'User Profile Update Successfully',
    USERPROFILE_NOT_FOUND: 'User Profile not found',
    USERPROFILE_DELETED: 'User Profile Deleted Successfully ',
    PROFILE_IMAGE_UPLOAD: 'Profile Image Uploaded Successfully',
  
  },
  buyerAuthMessage: {
    SIGNUP_SUCCESS: 'Signup Success',
    LOGIN_SUCCESS: 'Login Success',
    DUPLICATE_EMAIL: 'User already Exist with given Email',
    USER_NOT_FOUND: 'User Not Found',
    INVALID_PASSWORD: 'Incorrect Password',
    INVALID_EMAIL: 'Invalid Email Format',
    WEAK_PASSWORD: 'Weak password. Password must Contain at Least 8 Characters Including Uppercase, Lowercase and Digit',
    RESET_NEW_PASSWORD: 'Password Reset Successfully.',
    MATCH_PASSWORD: 'New Password and Confirm Password must Match.',
    INVALID_TOKEN: 'Invalid otp code .',
    TOKEN_SENT: "An Otp Code has been sent to your Email'",
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
