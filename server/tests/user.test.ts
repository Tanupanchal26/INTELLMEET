// @ts-nocheck
process.env.NODE_ENV = 'test';

jest.mock('../src/models/User', () => ({
  findByIdAndUpdate: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
}));

const User = require('../src/models/User');
const userService = require('../src/services/user.service');
const { ROLES } = require('../src/constants');

describe('userService.updateRole', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates a user role for an allowed role value', async () => {
    const updatedUser = { _id: 'user-1', role: ROLES.GUEST };
    const query = {
      select: jest.fn().mockReturnThis(),
    };
    User.findByIdAndUpdate.mockReturnValue(query);
    query.select.mockReturnValue(Promise.resolve(updatedUser));

    const result = await userService.updateRole('user-1', ROLES.GUEST);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-1',
      { role: ROLES.GUEST },
      { new: true, runValidators: true }
    );
    expect(result.role).toBe(ROLES.GUEST);
  });
});

export {};
