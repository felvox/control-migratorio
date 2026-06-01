export default () => ({
  port: Number(process.env.PORT ?? 3000),
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev_secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },
  session: {
    idleTimeoutMinutes: Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES ?? 30),
    touchIntervalSeconds: Number(process.env.SESSION_TOUCH_INTERVAL_SECONDS ?? 60),
    cleanupIntervalSeconds: Number(
      process.env.SESSION_CLEANUP_INTERVAL_SECONDS ?? 60,
    ),
    activeNowWindowMinutes: Number(
      process.env.SESSION_ACTIVE_NOW_WINDOW_MINUTES ?? 5,
    ),
    adminSingleSessionWindowMinutes: Number(
      process.env.ADMIN_SINGLE_SESSION_WINDOW_MINUTES ?? 30,
    ),
  },
  security: {
    loginMaxAttempts: Number(process.env.SECURITY_LOGIN_MAX_ATTEMPTS ?? 5),
    loginWindowMinutes: Number(process.env.SECURITY_LOGIN_WINDOW_MINUTES ?? 10),
    loginLockoutMinutes: Number(process.env.SECURITY_LOGIN_LOCKOUT_MINUTES ?? 15),
  },
  storage: {
    root: process.env.STORAGE_ROOT ?? '../storage',
    maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB ?? 10),
  },
});
