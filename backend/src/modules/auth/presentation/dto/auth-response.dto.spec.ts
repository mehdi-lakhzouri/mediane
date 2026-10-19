import {
  CurrentUserResponse,
  WebSessionPolicyResponse,
} from './auth-response.dto';

describe('auth response DTO runtime metadata', () => {
  it('initializes nested session-policy DTOs without a temporal dead zone', () => {
    expect(new WebSessionPolicyResponse()).toBeInstanceOf(
      WebSessionPolicyResponse,
    );
    expect(new CurrentUserResponse()).toBeInstanceOf(CurrentUserResponse);
  });
});
