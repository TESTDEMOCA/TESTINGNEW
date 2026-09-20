import { constants } from '../data/constants';
import { TIMEOUT } from '../data/timeouts';
import type { World } from '../fixtures/world';

export class LoginPage {
    constructor(private world: World) {}

    private get page() {
        return this.world.page;
    }

    async open(): Promise<void> {
        await this.page.goto(constants.urls.login);
        await this.page.waitForLoadState('domcontentloaded');

        if (await this.page.getByText(/Error 403/i).isVisible().catch(() => false)) {
            throw new Error(`Login page returned 403 from ${this.page.url()}`);
        }
    }

    async login(username: string, password: string): Promise<void> {
        const user = this.usernameField();
        const pass = this.passwordField();

        await user.waitFor({ state: 'visible', timeout: TIMEOUT.MEDIUM });
        await user.fill(username);
        await pass.fill(password);
        await this.page.getByRole('button', { name: 'Sign In' }).click();
    }

    private usernameField() {
        return this.page
            .getByRole('textbox', { name: 'Username' })
            .or(this.page.getByPlaceholder('Username'));
    }

    private passwordField() {
        return this.page
            .getByRole('textbox', { name: 'Password' })
            .or(this.page.getByPlaceholder('Password'));
    }
}
