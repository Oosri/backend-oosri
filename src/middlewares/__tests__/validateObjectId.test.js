const validateObjectId = require('../validateObjectId');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('validateObjectId middleware', () => {
  it('calls next() for a valid ObjectId', () => {
    const req = { params: { id: '507f1f77bcf86cd799439011' } };
    const res = mockRes();
    const next = jest.fn();

    validateObjectId('id')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-ObjectId string', () => {
    const req = { params: { id: 'not-an-objectid' } };
    const res = mockRes();
    const next = jest.fn();

    validateObjectId('id')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, status: 400 })
    );
  });

  it('returns 400 for an empty string', () => {
    const req = { params: { id: '' } };
    const res = mockRes();
    const next = jest.fn();

    validateObjectId('id')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('uses the correct param name in the error message', () => {
    const req = { params: { sellerId: 'bad-id' } };
    const res = mockRes();
    const next = jest.fn();

    validateObjectId('sellerId')(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('sellerId') })
    );
  });

  it('defaults to param name "id" when no argument given', () => {
    const req = { params: { id: 'bad' } };
    const res = mockRes();
    const next = jest.fn();

    validateObjectId()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});
