export const users = {
    regressionUser: {
        username: process.env.REGRESSION_USERNAME ?? '',
        password: process.env.REGRESSION_PASSWORD ?? '',
    },
} as const;

export type UserKey = keyof typeof users;
