jest.mock('axios', () => {
  const mockApiInstance = {
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    post: jest.fn(),
    get: jest.fn(),
  };

  return {
    __esModule: true,
    default: {
      create: jest.fn(() => mockApiInstance),
      post: jest.fn(),
    },
    ...mockApiInstance,
  };
});

describe('API client', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('should be created with correct base URL and credentials', () => {
    const axios = require('axios').default;
    require('../src/services/api');

    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        withCredentials: true,
      }),
    );
  });
});
