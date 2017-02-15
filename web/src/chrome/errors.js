// this is duplicated in typescript @ service/src/error.ts

export const errorDefinitions = {
  TopupExceedsMaxBalance: { message: 'Topping up would exceed your maximum balance', retryable: false },
  TooManyPurchaseItems: { message: "You're purchasing too many items", retryable: false },
  EmailNotFound: { message: "Couldn't find your email", retryable: true },
  NoCardDetailsPresent: { message: 'We have no card details for you', retryable: true },
  EmailTokenInvalid: { message: 'The magic link you followed has expired', retryable: false },
  StoreNotFound: { message: "We couldn't find that store code", retryable: true },
  LocalStorageBlocked: { message: "We can't hold onto your session in private browsing", retryable: false },
  NetworkError: { message: "Sorry, we're having trouble connecting", retryable: true },
  CardIncorrectNumber: { message: 'Incorrect card number', retryable: true },
  CardInvalidNumber: { message: 'Invalid card number', retryable: true },
  CardInvalidExpiryMonth: { message: 'Invalid expiry month', retryable: true },
  CardInvalidExpiryYear: { message: 'Invalid expiry year', retryable: true },
  CardIncorrectCVC: { message: 'Incorrect CVC', retryable: true },
  CardInvalidCVC: { message: 'Invalid CVC', retryable: true },
  CardExpired: { message: 'Card expired', retryable: true },
  CardDeclined: { message: 'Card declined', retryable: true },
  CardError: { message: 'Hit a problem with your card details', retryable: true }
};
