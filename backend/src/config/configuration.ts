export default () => ({
  port: Number(process.env.PORT ?? 3000),
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev_secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },
  storage: {
    root: process.env.STORAGE_ROOT ?? '../storage',
    maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB ?? 10),
  },
});
