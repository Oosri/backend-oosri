const bcrypt = require('bcryptjs');

jest.mock('../src/models/sellerModel');
jest.mock('../src/models/otpModel');
jest.mock('../src/utils/generateCode', () => jest.fn(() => '1234'));
jest.mock('../src/utils/cloudinary', () => ({ uploadSellerProfilePicture: jest.fn(), uploadSellerDocument: jest.fn() }));
jest.mock('../src/utils/avatarMap', () => ({ avatarMap: { Avatar1: 'https://cdn/avatar1.jpg' } }));
jest.mock('../src/queues/image.queue', () => ({ addImageJob: jest.fn().mockResolvedValue({}) }));
jest.mock('../src/queues/email.queue', () => ({ addEmailJob: jest.fn().mockResolvedValue({}) }));
jest.mock('../src/utils/cloudinarySignature', () => ({
  generatePresignedUrl: jest.fn(),
  validateCloudinaryUrl: jest.fn(),
  extractPublicId: jest.fn(),
}));
jest.mock('cloudinary', () => ({ v2: { config: jest.fn() } }));
jest.mock('../src/utils/emailService', () => ({}));

const Seller = require('../src/models/sellerModel');
const OtpCode = require('../src/models/otpModel');
const { sellerAccountSignup } = require('../src/controllers/sellerAuth.controller');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('sellerAccountSignup — re-registration password handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.SALT_ROUNDS = '10';
  });

  it('stores a bcrypt hash (not plaintext) when an unverified seller re-registers', async () => {
    const plainPassword = 'NewPassword123!';
    const savedData = {};

    const mockSeller = {
      _id: 'seller-id-1',
      isVerified: false,
      firstName: 'Old',
      lastName: 'Name',
      email: 'seller@example.com',
      password: 'old-hash',
      businessType: 'Individual',
      country: 'NG',
      profilePicture: 'https://cdn/avatar1.jpg',
      save: jest.fn().mockImplementation(async function () {
        Object.assign(savedData, this);
      }),
    };

    Seller.findOne = jest.fn().mockResolvedValue(mockSeller);
    OtpCode.findOne = jest.fn().mockResolvedValue(null);
    OtpCode.prototype.save = jest.fn().mockResolvedValue({});
    OtpCode.mockImplementation(() => ({
      email: 'seller@example.com',
      code: '1234',
      expiration: new Date(),
      save: jest.fn().mockResolvedValue({}),
    }));

    const req = {
      body: {
        firstName: 'New',
        lastName: 'Name',
        email: 'seller@example.com',
        password: plainPassword,
        businessType: 'Individual',
        country: 'NG',
        profilePicture: 'Avatar1',
      },
      file: null,
    };

    const res = makeRes();
    await sellerAccountSignup(req, res);

    const savedPassword = mockSeller.password;
    expect(savedPassword).not.toBe(plainPassword);
    const isHashed = await bcrypt.compare(plainPassword, savedPassword);
    expect(isHashed).toBe(true);
  });
});
