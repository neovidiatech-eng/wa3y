import rateLimit from "express-rate-limit";

// Generic rate limiter for auth routes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  handler: (req, res) => {
    res.status(429).json({
      message: req.t("TOO_MANY_ATTEMPTS_LIMIT_15M"),
      status: 429
    });
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// More strict limiter for OTP requests
export const otpRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 OTP requests per hour
  handler: (req, res) => {
    res.status(429).json({
      message: req.t("TOO_MANY_OTP_REQUESTS_1H"),
      status: 429
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});
