import { users, type UserKey } from '../data/users';

export function requireUser(userKey: string) {
    const user = users[userKey as UserKey];
    if (!user?.username || !user.password) {
        throw new Error(
            `Missing credentials for "${userKey}". Set REGRESSION_USERNAME and REGRESSION_PASSWORD in .env`
        );
    }
    return user;
}
