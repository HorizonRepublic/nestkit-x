export const network = {
  host: '0.0.0.0',
  ports: {
    http: 80,
    https: 443,
    maximal: 65535,
    minimal: 1,
    nest: 3000,
    postgres: 5432,
    redis: 6379,
  },
} as const;
