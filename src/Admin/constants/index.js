module.exports = {
    customServerResponse: {
      status: 400,
      message: '',
      body: {}
    },
    adminProductMessage: {
      PRODUCT_FETCHED: 'Product(s) Fetched Successfully',
      PRODUCT_REMOVED: 'Product Removed Successfully',
      PRODUCT_NOT_FOUND: 'Product Not Found',
      PRODUCT_APPROVED: 'Product Approved Successfully',
      PRODUCT_REJECTED: 'Product Rejected and Removed Successfully',
      PRODUCT_ACTION: 'Invalid action, you are only allowed to approve or reject a product',
    },
    adminAuthMessage: {
      SIGNUP_SUCCESS: 'Success',
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
}
  