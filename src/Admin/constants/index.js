module.exports = {
  customServerResponse: {
    status: 400,
    message: '',
    body: {}
  },
  adminProductMessage: {
    PRODUCT_FETCHED: 'Product(s) Fetched Successfully',
    PRODUCT_FETCHED_BY_ID: 'Product Fetched Successfully',
    PRODUCT_REMOVED: 'Product Removed Successfully',
    PRODUCT_NOT_FOUND: 'Product Not Found',
    PRODUCT_APPROVED: 'Product Approved Successfully',
    PRODUCT_REJECTED: 'Product Rejected and Removed Successfully',
    PRODUCT_ACTION: 'Invalid action, you are only allowed to approve or reject a product',
    PRODUCT_DELETE_ERROR: 'Failed to delete product',
    PRODUCT_FETCH_ERROR: 'Failed to fetch product(s)',
    PRODUCT_VISIBLE_ERROR: 'Failed to update product visibility',
    PRODUCT_ISVISIBLE: 'Invalid value for isVisible. It must be true or false.',
    PRODUCT_VISIBLE_UPDATED: 'Product visibility updated successfully'
  },
  salesAnalyticsMessage: {
    ANALYTICS_FETCHED: 'Product sales analytics fetched successfully',
    STATISTICS_FETCHED: 'Sales statistics fetched successfully',
    TOP_PRODUCTS_FETCHED: 'Top most purchased products fetched successfully',
  },
  adminAuthMessage: {
    SIGNUP_SUCCESS: 'Success',
    LOGIN_SUCCESS: 'Success',
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
    TOKEN_EXPIRED: 'Otp code has Expired',
    FIELD_REQUIRED: 'All Field are Required',
    EMAIL_ALREADY_CONFIRMED: 'Email Address has already been Confirmed.',
    EMAIL_NOT_CONFIRMED: 'Please verify your email before logging in',
    CONFIRM_TOKEN_SUCCESS: 'Email Confirmed Successfully',
    REFRESH_TOKEN_MISSING: 'Refresh Token Missing',
    USER_FETCH_SUCCESS: 'Current User Fetched Successfully',
    REFRESH_TOKEN_SUCCESS: 'Token Generated Successfully ',
    INVALID_REFRESH_MISSING: 'Invalid Refresh Token',
    VALID_TOKEN: 'OTP is valid'
  },
  adminProfileMessage: {
    USERPROFILE_CREATED: 'Profile Added Successfully',
    USERPROFILE_FETCHED: 'Profile Fetched Successfully',
    USERPROFILE_UPDATED: 'Profile Update Successfully',
    USERPROFILE_NOT_FOUND: 'Profile not found',
    USERPROFILE_DELETED: 'Profile Deleted Successfully ',
    PROFILE_IMAGE_UPLOAD: 'Profile Image Uploaded Successfully',
    INVALID_OLD_PASSWORD: 'Old password is incorrect',
    PASSWORD_CHANGED_SUCCESSFULLY: 'Password changed successfully',
    PASSWORD_SAME_AS_OLD: 'Your new password cannot be the same as your current password.',
    PASSWORD_CHANGED_SUCCESS: 'Password changed successfully'
  },
  adminOrderMessage: {
    ORDER_CREATED: 'Order Placed Successfully',
    ORDER_FETCHED: 'Order(s) Fetched Successfully',
    ORDER_REMOVED: 'Order Removed Successfully',
    ORDER_NOT_FOUND: 'Order Not Found',
    EMPTY_ORDER: 'No order is found',
    ORDER_UPDATED: 'Order Updated Successfully',
    ORDER_STATUS_UPDATED: 'Order status updated successfully',
    UNAUTHORIZED_ORDER: 'Order not found or not authorized to cancel this order',
    CANCELLATION_NOT_ALLOWED: 'Order cannot be cancelled at this stage',
    CANCELLED_ORDER: 'Order cancelled successfully',
    INVALID_ORDER_ID: 'Invalid order id'
  },
  adminDashboardMessage: {
    DASHBOARD_FETCHED: 'Dashboard data fetched successfully',
    SUMMARY_FETCH_ERROR: 'Failed to fetch dashboard summary',
    OVERVIEW_FETCH_ERROR: 'Failed to fetch dashboard sales overview'
  },
  adminSellerMessage: {
    SELLERS_FETCHED: 'Sellers Fetched Successfully',
    SELLER_FETCHED_BY_ID: 'Seller Fetched Successfully',
    SELLER_REMOVED: 'Seller Removed Successfully',
    SELLER_NOT_FOUND: 'Seller Not Found',
    SELLER_FETCH_ERROR: 'Failed to fetch seller(s)',
    SELLER_DELETE_ERROR: 'Failed to delete seller'
  },
  courierServiceMessage: {
    COURIER_CREATED: "Courier service created successfully",
    COURIER_CREATE_ERROR: "Error creating courier service",
    COURIER_FETCHED: "Courier services fetched successfully",
    COURIER_FETCH_ERROR: "Error fetching courier services",
    IMAGE_REQUIRED: "Courier service image is required"
  },
  requestValidationMessage: {
    BAD_REQUEST: 'Invalid fields',
    TOKEN_MISSING: 'Token missing from header',
    FORBIDDEN: 'Access denied. Admins only.',
    SUPER_ADMIN_ONLY: 'Access denied. Super admin only.',
  },
  adminManagementMessage: {
    ADMIN_LIST_FETCHED: 'Admins fetched successfully',
    ADMIN_FETCHED: 'Admin fetched successfully',
    ADMIN_UPDATED: 'Admin updated successfully',
    ADMIN_DELETED: 'Admin deleted successfully',
    ADMIN_NOT_FOUND: 'Admin not found',
    CANNOT_DELETE_SELF: 'You cannot delete your own account',
    CANNOT_DEMOTE_SUPER: 'Cannot modify another super admin',
  },
  databaseMessage: {
    INVALID_ID: 'Invalid Id'
  }
};
